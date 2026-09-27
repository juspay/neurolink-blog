---
layout: post
title: 'Grading the model: the scorer hierarchy and evaluation pipeline'
date: '2026-06-23 10:00:00 +0530'
categories:
  - Deep Dive
  - Engineering
tags:
  - neurolink
author: neurolink
description: >-
  Inside NeuroLink's evaluation system: the BaseScorer/BaseLLMScorer/BaseRuleScorer
  class hierarchy, the PipelineBuilder-driven EvaluationPipeline that runs scorers
  together, and how batching, factories, and observability hooks fit around it.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/grading-the-model-the-scorer-hierarchy-and-evaluation-pipeline/hero.png
  alt: 'Grading the model: the scorer hierarchy and evaluation pipeline'
---

We designed NeuroLink's scorer hierarchy because a single, monolithic evaluation function was difficult to test, extend, or debug. If a RAG pipeline's `FaithfulnessScorer` were to start returning anomalous scores — say, after an upstream provider changed its output format — a monolithic function would give us no way to isolate that from the `ToxicityScorer` or the deterministic `FormatScorer` running in the same evaluation pass. A failure in one check could silently corrupt the entire result. We needed a system where every evaluation concern was a distinct, composable class, managed by a predictable pipeline.

This post dives deep into that architecture. It's the next level of detail from our previous post on [Model Evaluation and Scoring: RAGAS-Style Quality Assessment](/posts/model-evaluation-scoring/), which covered the *what* of our metrics. Here, we cover the *how*: the class hierarchy, the pipeline orchestrator, and the observability hooks that make our evaluation system robust and extensible.

## The Scorer Class Hierarchy

At the root of the system is `BaseScorer`. This abstract class defines the universal contract for any scorer: a `score` method that takes an input and returns a result. It also provides foundational utilities that all scorers inherit, including input validation, score normalization, and a robust `executeWithRetry` mechanism for handling transient network failures.

From this base, the hierarchy splits into two distinct branches.

- `BaseLLMScorer` is the parent for any evaluation that requires a provider call. It introduces the core abstractions for this pattern: an abstract `generatePrompt` method to create the provider-specific prompt and an abstract `parseResponse` method to interpret the model's output. It handles the mechanics of the actual API call through its `callLLM` method.

- `BaseRuleScorer` is the parent for deterministic, offline evaluations. It operates without any external LLM calls. Instead, it manages a collection of `ScorerRule` objects and provides an `evaluateRule` method to execute them. It supports multiple modes for combining rule results, such as requiring all rules to pass (`all`), any rule to pass (`any`), or calculating a weighted score.

This division ensures a clean separation of concerns. A scorer either talks to an LLM or it does not. There is no ambiguity.

```typescript
// All scorers, regardless of type, share a common foundation.
export abstract class BaseScorer {
  // The universal contract for all scorers
  abstract score(input: ScorerInput): Promise<ScoreResult>;

  // Built-in resilience for any scorer
  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    ...
  ): Promise<T>;
}

// For scorers that call a provider like OpenAI or Anthropic
export abstract class BaseLLMScorer extends BaseScorer {
  abstract generatePrompt(input: ScorerInput): string;
  abstract parseResponse(response: string, input: ScorerInput): Partial<ScoreResult>;

  protected async callLLM(prompt: string): Promise<string>;
}

// For deterministic, offline checks
export abstract class BaseRuleScorer extends BaseScorer {
  abstract getRules(): ScorerRule[];
  abstract evaluateRule(rule: ScorerRule, input: ScorerInput): RuleResult;
}
```

## The Scorer Implementations

The `scorers/` directory contains the concrete implementations of this hierarchy. NeuroLink ships with over a dozen pre-built scorers, each targeting a specific quality dimension.

The LLM-based scorers, which extend `BaseLLMScorer`, include:

- `FaithfulnessScorer`: Checks if the model's answer is factually grounded in the provided context.
- `HallucinationScorer`: Detects statements that are not supported by the context.
- `AnswerRelevancyScorer`: Measures if the answer directly addresses the user's question.
- `ContextPrecisionScorer`: Evaluates if the context provided to the LLM was relevant and concise.
- `ToxicityScorer`: Flags harmful, offensive, or biased language.
- `SummarizationScorer`: Assesses the quality of a summary against the original text.
- `ToneConsistencyScorer`: Checks if the response adheres to a specified tone.

The rule-based scorers, which extend `BaseRuleScorer`, handle deterministic checks:

- `FormatScorer`: Validates that the output conforms to a required format (e.g., JSON, XML, Markdown).
- `KeywordCoverageScorer`: Ensures specific keywords are present in the output.
- `LengthScorer`: Checks if the output is within a given length range.

A special case is `ContentSimilarityScorer`, which extends `BaseScorer` directly. It uses algorithms like Jaccard and Levenshtein distance to measure similarity without an LLM call.

```typescript
// src/lib/evaluation/scorers/llm/answerRelevancyScorer.ts
export class AnswerRelevancyScorer extends BaseLLMScorer {
  // Each LLM scorer implements a specific prompt generation strategy.
  generatePrompt(input: ScorerInput): string {
    const { query, response } = input;
    if (!query || !response) {
      throw new Error("Query and response are required for AnswerRelevancyScorer.");
    }
    // The prompt asks a separate evaluation model to grade the primary model's output.
    return `
      Given the question: "${query}"
      And the answer: "${response}"

      Please evaluate the relevancy of the answer to the question on a scale of 1 to 10.
      A score of 1 means completely irrelevant.
      A score of 10 means perfectly relevant.
      Provide your reasoning in a JSON object with "score" and "reason" fields.
    `;
  }

  // It also implements a corresponding response parser.
  parseResponse(response: string, input: ScorerInput): Partial<ScoreResult> {
    const json = this.extractJSON(response);
    return {
      score: json?.score,
      reasoning: json?.reason,
    };
  }
}
```

## Registration and Custom Builders

Scorers aren't used via direct instantiation. Instead, they are managed by the `ScorerRegistry`. On startup, `ScorerRegistry.registerBuiltInScorers()` dynamically imports and registers all the standard scorers, making them available by ID.

For cases where a full class is overkill, we built `ScorerBuilder`. This fluent API lets you define a custom scorer programmatically. You can create simple rule-based scorers for checking patterns, keywords, or length on the fly. For more complex logic, `createFunctionScorer` wraps any function into a valid scorer object, and `composeScorers` can combine multiple scorers into a single, weighted evaluation.

```typescript
// Dynamically creating a rule-based scorer without a new class.
const jsonFormatScorer = ScorerBuilder.create('custom-json-check', 'JSON Format Check')
  .description('Ensures the output is valid JSON')
  .type('rule')
  .customRule({
    id: 'is-json',
    description: 'Is Valid JSON',
    type: 'custom',
    params: {
      evaluate: (input: ScorerInput) => {
        try {
          JSON.parse(input.response);
          return { passed: true, score: 1 };
        } catch {
          return { passed: false, score: 0 };
        }
      },
    },
  })
  .build();
```

## The Evaluation Pipeline

Individual scorers are the building blocks. The `EvaluationPipeline` is the engine that runs them. It takes a set of scorers and an input, executes the scorers, and aggregates their results. This architecture is distinct from the main API request lifecycle described in [From User Input to Provider API: The Five-Stage Message Flow](/posts/from-user-input-to-provider-api-the-five-stage-message-flow/); this is a dedicated, post-processing evaluation stage.

We use the `PipelineBuilder` to construct pipelines. It offers a fluent API for adding scorers, setting execution policies, and defining aggregation strategies. You can run scorers in parallel with `parallel()` for speed or in sequence with `sequential()` for dependent checks. You can also configure whether the pipeline should `stopOnFailure()` or `continueOnFailure()`.

```mermaid
graph TD
    subgraph Pipeline Execution
        A[ScorerInput] --> B{EvaluationPipeline};
        B -- dispatches to --> C1["FaithfulnessScorer - LLM"];
        B -- dispatches to --> C2["FormatScorer - Rule"];
        B -- dispatches to --> C3["..."];
    end

    subgraph Scoring
        C1 -- calls provider --> D["External LLM Provider"];
        D -- response --> C1;
        C1 --> E1[ScoreResult];
        C2 -- evaluates rules --> E2[ScoreResult];
        C3 --> E3[ScoreResult];
    end

    subgraph Aggregation
        E1 --> F{EvaluationAggregator};
        E2 --> F;
        E3 --> F;
        F -- calculates stats --> G[Final EvaluationData];
    end
```

The builder produces an `EvaluationPipeline` instance, ready to execute. For common use cases, we ship a set of `PipelinePresets` like `safety`, `rag`, `quality`, and `codeGeneration`, which provide pre-configured pipelines for turnkey evaluations.

```typescript
// Building a RAG quality pipeline using the fluent API
const ragPipeline = await PipelineBuilder.create('rag-quality-pipeline')
  .description('Evaluates the quality of a RAG system response.')
  .addScorer('faithfulness')
  .addScorer('answer-relevancy')
  .addScorer('context-precision')
  .aggregateWith('weighted')
  .withWeights({
    'faithfulness': 0.5,
    'answer-relevancy': 0.3,
    'context-precision': 0.2,
  })
  .parallel()
  .timeout(5000)
  .buildAndInitialize();

// const results = await ragPipeline.execute(myScorerInput);
```

## Batch Processing at Scale

Evaluating a single interaction is useful, but robust quality assessment requires running evaluations over large datasets. `BatchStrategy`, in `pipeline/strategies/`, is built for exactly this: it wraps an `EvaluationPipeline` and exposes an `evaluate` method that runs an array of `ScorerInput` through the pipeline with a configurable concurrency limit, `continueOnError` handling, and progress/result callbacks.

NeuroLink also ships a `BatchEvaluator`, but it batches a different, adjacent system: the single-call, RAGAS-style auto-evaluator (`Evaluator`) that grades one `generate()` result at a time, not the scorer `EvaluationPipeline`. It takes a config object (`concurrency`, `maxRetries`, `retryDelay`) and runs `evaluateBatch` over an array of `{ id, options, result }` items. This is a core part of our internal quality control, as detailed in [How We Test NeuroLink: 20 Continuous Test Suites and Counting](/posts/neurolink-testing-20-test-suites/).

```typescript
// Running an EvaluationPipeline over a dataset with BatchStrategy
async function runBulkEvaluation(pipeline: EvaluationPipeline, dataset: ScorerInput[]) {
  const batchStrategy = new BatchStrategy(pipeline, {
    concurrency: 10,        // Process 10 items in parallel
    continueOnError: true,  // Keep going if one item fails
  });

  const { summary } = await batchStrategy.evaluate(dataset);
  console.log(`Batch evaluation complete: ${summary.passingRate}% passing`);
}
```

## The Factory and Registry Bridge

The RAGAS-style `Evaluator` track has its own factory and registry — `EvaluatorFactory` and `EvaluatorRegistry` — following the same singleton-factory pattern we use for providers, as seen in our [adapter catalog](/posts/twenty-four-providers-one-baseprovider-the-adapter-catalog/).

`EvaluatorFactory.getInstance()` resolves named configuration presets (`default`, `strict`, `lenient`, `fast`, `premium`, or a custom one registered with `registerPreset`) into a configured `Evaluator`, selecting the backing LLM via environment variables like `NEUROLINK_RAGAS_EVALUATION_PROVIDER`. `EvaluatorRegistry.getInstance()` is a separate singleton holding pluggable evaluation *strategies* (the built-in `ragas` strategy, plus any custom one you register) rather than pipeline presets. `BatchEvaluator`, covered above, is built on this same `Evaluator`, not on `EvaluationPipeline`.

The scorer/pipeline hierarchy has its own, simpler preset mechanism instead: `getPreset(name)` returns a `PipelineConfig` for `safety`, `rag`, `quality`, `codeGeneration`, and the other `PipelinePresets`, which you pass to `new EvaluationPipeline(config)` or build the same shape with `PipelineBuilder`.

```typescript
// Getting a pre-configured evaluator for the current environment
async function getEvaluatorForEnvironment() {
  const factory = EvaluatorFactory.getInstance();

  // Resolves the 'strict' preset and configures its backing LLM
  // based on environment variables.
  const strictEvaluator = await factory.create('strict');

  return strictEvaluator;
}
```

## Observability and Reporting

A black-box evaluation pipeline is a blind spot. We built `ObservabilityHooks` to provide deep visibility into the evaluation process. It's a typed event emitter that fires lifecycle events: `pipeline:start`, `pipeline:end`, `scorer:start`, and `scorer:end`.

You can subscribe to these events to log performance, trace execution, or collect metrics. We ship a `MetricsCollector` that does exactly this. The `createMetricsCollectorHook` adapter wires the collector to the pipeline's events, automatically tracking per-scorer latency, success rates, and score distributions. For external systems, we also provide adapters like `LangfuseAdapter` to stream evaluation data to third-party observability platforms. Finally, `ReportGenerator` can consume the aggregated data to produce human-readable quality reports.

```typescript
// Subscribing to lifecycle events for custom logging
const pipeline = await new PipelineBuilder().addScorer('toxicity').buildAndInitialize();

const hooks = new ObservabilityHooks();
hooks.on('scorer:start', ({ scorerName }) => console.log(`Scorer ${scorerName} started.`));
hooks.on('scorer:end', ({ scorerName, result }) => {
  console.log(`Scorer ${scorerName} finished with score ${result.score}.`);
});

// The pipeline doesn't wire itself to a hooks instance automatically — emit
// lifecycle events yourself around the calls you want observed, e.g.:
// await hooks.emit('scorer:start', { scorerId, scorerName, timestamp: Date.now() });
const result = await pipeline.execute(myScorerInput);
```

## Structured Error Handling

Reliable automation depends on predictable error handling. Every potential failure point in the evaluation pipeline, from input validation to provider timeouts, is mapped to a set of `EvaluationErrorCodes`. When a scorer or pipeline fails, it does so with a structured error, not just a generic exception. This allows consuming systems to build robust retry and alerting logic tailored to the specific failure mode.

```typescript
try {
  await pipeline.execute(input);
} catch (e) {
  if (e.code === EvaluationErrorCodes.PROVIDER_ERROR) {
    // Specific logic for when the evaluation model is down
    console.error("Evaluation provider is unavailable. Retrying later.");
  } else {
    // General error handling
    console.error("An unexpected evaluation error occurred:", e.message);
  }
}
```

---

**Related posts:**

- [What You Actually Inherit When You Extend BaseProvider](/posts/what-you-actually-inherit-when-you-extend-baseprovider/)
- [How We Test NeuroLink: 20 Continuous Test Suites and Counting](/posts/neurolink-testing-20-test-suites/)
