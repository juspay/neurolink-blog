---
layout: post
title: 'AI in Production: Lessons from Serving Millions of Requests at Juspay'
date: '2025-09-01 10:00:00 +0530'
categories:
  - Thought Leadership
  - Production
tags:
  - production-ai
  - juspay
  - lessons-learned
  - scale
  - reliability
  - fintech
  - neurolink
  - enterprise
  - observability
author: neurolink
description: >-
  Hard-won lessons from serving millions of AI requests at Juspay. Error
  handling, fallback strategies, cost management, and observability patterns.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/ai-in-production-juspay-lessons/hero.png
  alt: 'AI in Production: Lessons from Serving Millions of Requests at Juspay'
---

The gap between "AI works in my notebook" and "AI works in production serving millions of requests" is not a gap -- it is a chasm. It is the most underestimated challenge in AI adoption, and most teams fall in.

Juspay processes millions of payment transactions daily. When we added AI to that pipeline, every assumption from the prototyping phase broke. Providers went down during peak traffic. A single model change doubled our monthly costs overnight. Debugging a bad response required correlating logs across three services with no trace IDs. We learned every lesson the hard way.

NeuroLink was extracted from this production infrastructure. Every feature exists because we needed it at 3 AM during an incident. This post shares seven of those lessons -- the problem we faced, the approach that failed, the solution that worked, and how it became a reusable pattern in the SDK.

## Lesson 1: Every provider will go down

### The Problem

In our first month of production AI deployment, we experienced outages from three different providers. OpenAI had a 45-minute degradation. Anthropic went fully down for 20 minutes. Google Vertex had intermittent 503s for an hour. Each outage was a customer-facing incident because our architecture assumed the provider would always be available.

### The Failed Approach

Our initial response was manual: monitoring dashboards, Slack alerts, and an engineer on call who would switch the configuration to a backup provider. Response time was 15-30 minutes. For a payment platform, 15 minutes of degraded AI service means thousands of affected transactions.

### The Solution: Automatic Failover with Circuit Breakers

We built three patterns that now ship as NeuroLink core utilities:

**Circuit Breaker**: After N consecutive failures, stop trying the primary provider for a cooldown period. This prevents cascading failures where a down provider causes timeout storms that affect your entire application.

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();
```

The `CircuitBreaker` class in `src/lib/utils/errorHandling.ts` implements this pattern with configurable failure thresholds (`CIRCUIT_BREAKER` constant) and cooldown periods (`CIRCUIT_BREAKER_RESET_MS`).

**Retry with Exponential Backoff**: The `withRetry()` utility retries failed requests with increasing delays. Constants `RETRY_ATTEMPTS` and `RETRY_DELAYS` from `src/lib/constants/retry.ts` control the behavior. Retries only happen for retriable errors (timeouts, rate limits, server errors) -- not for authentication failures or invalid model errors.

**Timeout Wrapper**: The `withTimeout()` utility prevents hanging requests. Provider-specific timeouts from `PROVIDER_TIMEOUTS` in `src/lib/constants/timeouts.ts` ensure that a slow provider does not block your request pipeline indefinitely.

### The Result

Automatic failover reduced our incident response time from 15 minutes to under 500 milliseconds. The circuit breaker detects the failure, the retry logic confirms it is not transient, and the fallback provider takes over. No human intervention required.

> **Note:** Use `createAIProviderWithFallback()` from `@juspay/neurolink` to set up primary/fallback provider pairs with a single function call. The circuit breaker and retry logic are built in.
{: .prompt-info }

## Lesson 2: You will use more than one model

### The Problem

We started with a single model for everything -- GPT-4 for fraud detection, customer support, transaction classification, and reporting. The result was predictable: expensive and slow. A simple "Is this a credit card transaction?" classification does not need a frontier model. But complex fraud pattern analysis absolutely does.

### The Solution: Task-Based Routing

We categorized our AI tasks by complexity and mapped them to appropriate model tiers:

- **Simple queries** (classification, extraction, formatting) -> cheap, fast models (Claude Haiku, GPT-4o-mini)
- **Complex analysis** (multi-step reasoning, nuanced interpretation) -> frontier models (Claude Sonnet, GPT-4o)
- **Deep reasoning tasks** (mathematical proofs, complex planning) -> specialized reasoning models (o3, extended thinking)

This lesson drove the development of two NeuroLink components:

- **ModelRouter** (`src/lib/utils/modelRouter.ts`): Classifies incoming prompts as "fast" or "reasoning" tasks and routes them to the appropriate model tier automatically.

- **BinaryTaskClassifier** (`src/lib/utils/taskClassifier.ts`): A lightweight classifier that determines prompt complexity without an LLM call, using heuristics like prompt length, keyword analysis, and structural complexity.

- **Workflow engine** (`src/lib/workflow/`): For the most critical decisions, the workflow engine can run multiple models in parallel (ensemble strategy), chain models sequentially, or adaptively select the best strategy based on task characteristics.

### The Result

Task-based routing reduced our AI costs by over 60% while maintaining quality for high-value tasks. The cheap, fast models handle 80% of requests. The expensive models handle the 20% that actually need their capabilities.

## Lesson 3: Structured error handling saves hours of debugging

### The Problem

When an AI provider returns an error, the raw error message is usually useless. "API error" tells you nothing. "Request failed with status code 429" tells you slightly more, but you still need to check which provider it came from, whether it is retriable, and what action to take.

Worse, different providers return errors in completely different formats. OpenAI returns JSON with an `error.message` field. Anthropic returns a different JSON structure. Bedrock returns AWS-style errors. Debugging production issues meant reading raw HTTP responses and matching them to provider documentation.

### The Solution: Typed Error Classification

```typescript
import { NeuroLink } from '@juspay/neurolink';

try {
  const result = await neurolink.generate({
    input: { text: "Analyze this transaction" },
    provider: "openai",
    model: "gpt-4o",
  });
} catch (error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error);

  if (message.includes('rate limit') || message.includes('429')) {
    // Rate limit — exponential backoff
    await delay(Math.pow(2, attempt) * 1000);
    continue;
  } else if (message.includes('authentication') || message.includes('401') || message.includes('api key')) {
    // Auth error — no retry
    logger.error('Authentication failed — check API key');
    throw error;
  } else if (message.includes('model') || message.includes('not found')) {
    // Invalid model — no retry
    logger.error(`Model not available: ${error}`);
    throw error;
  } else if (message.includes('network') || message.includes('ECONNREFUSED') || message.includes('timeout')) {
    // Network error — retry with backoff
    await delay(Math.pow(2, attempt) * 1000);
    continue;
  }
  throw error;
}
```

> **Note:** NeuroLink throws standard JavaScript `Error` objects from provider calls. Use message-based inspection (checking `error.message` for keywords) rather than `instanceof` checks, as the SDK's internal error classes are not currently exported from the public API.
{: .prompt-info }

The `ErrorFactory` in `src/lib/utils/errorHandling.ts` normalizes raw provider errors into typed exceptions. Each provider's `handleProviderError()` method translates provider-specific error formats into a consistent type hierarchy.

Supporting utilities include:

- **`logStructuredError()`**: Produces consistent, searchable log output with provider, model, error type, and request context.
- **`isRetriableError()`**: Determines whether automatic retry is appropriate for a given error type.

### The Result

Structured errors turned "API error" into actionable information. Rate limit errors trigger backoff. Auth errors page the ops team. Invalid model errors trigger fallback to an alternative model. Debugging time dropped from hours to minutes.

## Lesson 4: Observability is not optional

### The Problem

In the early days, we had no visibility into our AI pipeline. Token usage was a monthly surprise on the invoice. Latency was "it feels slow." Error rates were "users are complaining." Cost attribution across teams was pure guesswork.

You cannot optimize what you cannot measure. And in a regulated environment, "we do not know how many tokens we consumed" is not an acceptable answer.

### The Solution: Built-in Observability

We built observability into the SDK at three levels:

**OpenTelemetry Integration**: Distributed tracing for every AI request, integrated with your existing observability stack.

```typescript
import {
  initializeOpenTelemetry,
  shutdownOpenTelemetry,
  flushOpenTelemetry,
} from '@juspay/neurolink';

await initializeOpenTelemetry({
  serviceName: 'my-ai-service',
  endpoint: 'http://jaeger:4318',
});

// Analytics automatically track latency, tokens, costs, errors
```

Functions like `initializeOpenTelemetry()`, `getTracer()`, and `getTracerProvider()` from `src/lib/services/server/ai/observability/instrumentation.ts` provide full OTLP compatibility. Export traces to Jaeger, Grafana Tempo, Datadog, or any OTLP-compatible backend.

**Langfuse Integration**: AI-specific monitoring that goes beyond generic tracing. `setLangfuseContext()` and `getLangfuseHealthStatus()` provide prompt versioning, evaluation tracking, and cost breakdowns per prompt template.

**Analytics Middleware**: The `createAnalyticsMiddleware()` function from `src/lib/middleware/builtin/analytics.ts` collects per-request metrics automatically -- token usage, response time, model performance -- without any code changes to your generation calls.

### The Result

Full observability transformed our operations. We could attribute costs to specific features, identify slow prompts, detect model quality degradation over time, and provide audit trails for regulatory compliance.

## Lesson 5: Memory management is critical at scale

### The Problem

Conversation context grows unbounded. A customer support session that lasts 20 turns can accumulate thousands of tokens of context, eventually hitting the model's context window limit. In-memory conversation storage is not persistent across server restarts. And uncleaned conversation state from abandoned sessions creates memory leaks.

### The Solution: Redis-Backed Conversation Memory

```typescript
const neurolink = new NeuroLink({
  conversationMemory: {
    enabled: true,
    redis: { url: 'redis://localhost:6379' },
  },
});
```

The `ConversationMemoryManager` in `src/lib/core/conversationMemoryManager.ts` handles in-memory conversations. The `RedisConversationMemoryManager` in `src/lib/core/redisConversationMemoryManager.ts` provides persistent, shared storage that survives restarts and scales across multiple server instances.

`MEMORY_THRESHOLDS` constants control automatic cleanup: conversations that exceed token limits are truncated (preserving the system prompt and most recent turns), and abandoned sessions are expired after a configurable timeout.

For applications that need intelligent, long-term memory -- remembering user preferences, past decisions, and context across sessions -- NeuroLink integrates with Mem0 via `initializeMem0()` in `src/lib/memory/mem0Initializer.ts`.

### The Result

Redis-backed memory eliminated the "my server restarted and lost all conversations" class of incidents. Mem0 integration enabled truly intelligent agents that remember context across days and weeks.

## Lesson 6: Human-in-the-loop for regulated industries

### The Problem

In fintech, AI cannot autonomously execute high-risk operations. A model that decides to refund a transaction, update an account balance, or transfer funds without human approval is a compliance violation. Regulatory requirements mandate human oversight for certain action categories.

We needed the ability to pause AI execution mid-flow, present the proposed action to a human reviewer, wait for approval or rejection, and then resume or abort.

### The Solution: HITL Manager

```typescript
const neurolink = new NeuroLink({
  hitl: {
    enabled: true,
    dangerousActions: ['executePayment', 'updateAccount'],
  },
});
```

The `HITLManager` in `src/lib/hitl/hitlManager.ts` intercepts tool execution calls that match the `dangerousActions` list. When a match is found, execution pauses and emits a confirmation event. The application presents the proposed action to a human reviewer. The reviewer can approve (execution resumes), reject (execution is cancelled), or modify the parameters before approval.

> **Note:** The `dangerousActions` field uses keyword matching. If any tool name contains a keyword from the list, HITL confirmation is required. This provides broad coverage without maintaining an exhaustive list.
{: .prompt-info }

### The Result

HITL enabled us to deploy AI agents in regulated environments. Auditors could verify that high-risk actions were reviewed. Compliance teams had a clear paper trail. And the engineering team did not need to build a custom approval system -- it shipped with the SDK.

## Lesson 7: The middleware pattern saves you from code spaghetti

### The Problem

As we added cross-cutting concerns -- logging, rate limiting, input validation, PII detection, response caching, analytics -- each new feature added more if-statements to the request pipeline. The `generate()` call was wrapped in try-catch blocks inside timing functions inside validation checks inside caching logic. Business logic was invisible under layers of infrastructure code.

### The Solution: Middleware Pipeline

```typescript
import { MiddlewareFactory } from '@juspay/neurolink';

const middleware = MiddlewareFactory.create({
  analytics: { enabled: true },
  guardrails: { enabled: true },
});
```

The `MiddlewareFactory` in `src/lib/middleware/factory.ts` provides a clean pipeline architecture. Built-in middleware (analytics, guardrails, auto-evaluation) handles the most common concerns. Custom middleware extends the pipeline for domain-specific needs. Priority ordering ensures middleware execute in the right sequence.

The middleware wraps the language model itself (via `wrapLanguageModel`), so it applies transparently to both `generate()` and `stream()` calls. Your business logic stays clean -- it just calls `neurolink.generate()` and the middleware handles everything else.

### The Result

Middleware separated infrastructure concerns from business logic. Adding a new cross-cutting concern went from "modify 20 endpoints" to "register one middleware." For a detailed walkthrough of the middleware system, see [The Middleware System: Analytics, Guardrails, and Custom Pipelines](/posts/middleware-system/).

## Key takeaways

| Lesson | Pattern | NeuroLink Feature |
|--------|---------|-------------------|
| Providers go down | Automatic failover | CircuitBreaker + fallback |
| One model is not enough | Task-based routing | ModelRouter + workflows |
| Debug needs structure | Typed error handling | ErrorFactory + classification |
| You need visibility | Built-in observability | OpenTelemetry + Langfuse |
| Memory must be managed | External persistence | Redis + Mem0 |
| Regulation needs humans | HITL workflows | HITLManager |
| Cross-cutting concerns | Middleware pipeline | MiddlewareFactory |

## Conclusion

Production AI is about reliability, not capability. The most capable model is useless if it is down, unmonitored, or unauditable.

The common thread across all seven lessons: production-grade AI is not about the model -- it is about everything around the model. Error handling. Fallback. Observability. Memory management. Human oversight. Cost management. These are the features that determine whether your AI application survives its first month in production.

We learned every one of these lessons through incidents, cost surprises, and compliance audits. NeuroLink encodes them as reusable components so you do not have to repeat our mistakes.

For audit and compliance patterns, explore our guide on [enterprise security](/posts/enterprise-security-guide/).

---

**Related posts:**

- [Error Handling Patterns for AI Applications](/posts/error-handling-patterns/)
- [LLM Cost Optimization: Practical Strategies to Reduce Your AI Spend](/posts/cost-optimization-strategies/)
- [Multi-Provider Failover: Never Lose an API Call](/posts/provider-failover-patterns/)
