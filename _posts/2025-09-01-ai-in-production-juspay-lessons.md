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
  Production patterns for AI at scale: typed errors, explicit fallback,
  cost-aware routing, observability, memory, HITL, and middleware boundaries.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/ai-in-production-juspay-lessons/hero.png
  alt: 'AI in Production: Lessons from Serving Millions of Requests at Juspay'
---

The gap between "AI works in my notebook" and "AI works in production serving millions of requests" is not a gap -- it is a chasm. It is the most underestimated challenge in AI adoption, and most teams fall in.

Juspay processes millions of payment transactions daily. Adding AI to high-volume production systems exposes assumptions that are easy to miss in a prototype: providers can degrade, model changes can alter cost, and responses are difficult to trace when logs do not share a request ID.

NeuroLink was built at Juspay, where it also powers products like Tara, Yama, and Clairvoyance. This post presents seven production patterns -- the problem, the approach that fails, and the reusable NeuroLink features that can support a solution.

## Lesson 1: Every provider will go down

### The Problem

Every AI provider can fail or degrade. A deployment may encounter timeouts, intermittent server errors, rate limits, or a wider provider outage. If your architecture assumes a provider will always be available, each failure can become customer-facing.

### The Failed Approach

A team relying on manual failover must wait for monitoring to detect a problem and for an operator to switch configuration to a backup provider. That adds human response time to an already-failing request path.

### The Solution: Application-Controlled Failover

Use separate resilience mechanisms deliberately:

**Circuit Breaker**: After N consecutive failures, stop trying the primary provider for a cooldown period. This prevents cascading failures where a down provider causes timeout storms that affect your entire application.

```typescript
import { createAIProviderWithFallback } from '@juspay/neurolink';

const { primary, fallback } = await createAIProviderWithFallback(
  'vertex',
  'bedrock'
);

const options = { input: { text: 'Analyze this transaction' } };

const generateWithFallback = async () => {
  try {
    return await primary.generate(options);
  } catch (error) {
    console.warn('Primary provider failed; trying fallback', error);
    return fallback.generate(options);
  }
};

const result = await generateWithFallback();
```

`createAIProviderWithFallback()` constructs the two provider instances. The application decides when to call the fallback. A circuit breaker can separately wrap the primary operation to stop sending requests during a sustained failure; it does not switch providers by itself.

**Retry with Exponential Backoff**: The `withRetry()` utility retries failed requests with increasing delays. Constants `RETRY_ATTEMPTS` and `RETRY_DELAYS` from `src/lib/constants/retry.ts` control the behavior. Retries only happen for retriable errors (timeouts, rate limits, server errors) -- not for authentication failures or invalid model errors.

**Timeout Wrapper**: The `withTimeout()` utility prevents hanging requests. Provider-specific timeouts from `PROVIDER_TIMEOUTS` in `src/lib/constants/timeouts.ts` ensure that a slow provider does not block your request pipeline indefinitely.

### The Result

Explicit fallback keeps the switching policy visible in application code. Retry transient failures before switching when that matches your latency budget, and add circuit-breaking separately so repeated primary failures do not create timeout storms.

> **Note:** `createAIProviderWithFallback()` creates a primary/fallback provider pair; it does not perform the request switch. If you prefer centralized fallback policy, configure NeuroLink's `providerFallback` callback to return the next `{ provider, model }` for a failed generation.
{: .prompt-info }

## Lesson 2: You will use more than one model

### The Problem

Using a single flagship model for everything -- classification, extraction, customer support, and complex analysis -- can be unnecessarily expensive and slow. A simple "Is this a credit card transaction?" classification does not need a frontier model, while a nuanced multi-step analysis may benefit from one.

### The Solution: Task-Based Routing

Categorize AI tasks by complexity and map them to appropriate model tiers:

- **Simple queries** (classification, extraction, formatting) -> cheap, fast models (Claude Haiku, GPT-5.4-mini)
- **Complex analysis** (multi-step reasoning, nuanced interpretation) -> frontier models (Claude Sonnet, GPT-5.4)
- **Deep reasoning tasks** (mathematical proofs, complex planning) -> specialized reasoning models (GPT-5.4 Pro, extended thinking)

This lesson drove the development of two NeuroLink components:

- **ModelRouter** (`src/lib/utils/modelRouter.ts`): Classifies incoming prompts as "fast" or "reasoning" tasks and routes them to the appropriate model tier automatically.

- **BinaryTaskClassifier** (`src/lib/utils/taskClassifier.ts`): A lightweight classifier that determines prompt complexity without an LLM call, using heuristics like prompt length, keyword analysis, and structural complexity.

- **Workflow engine** (`src/lib/workflow/`): For the most critical decisions, the workflow engine can run multiple models in parallel (ensemble strategy), chain models sequentially, or adaptively select the best strategy based on task characteristics.

### The Result

Task-based routing can reduce cost and latency while reserving frontier-model capacity for work that benefits from it. Measure quality by task category before changing routes; the right distribution depends on your workload.

## Lesson 3: Structured error handling saves hours of debugging

### The Problem

When an AI provider returns an error, the raw error message is usually useless. "API error" tells you nothing. "Request failed with status code 429" tells you slightly more, but you still need to check which provider it came from, whether it is retriable, and what action to take.

Worse, different providers return errors in completely different formats. OpenAI returns JSON with an `error.message` field. Anthropic returns a different JSON structure. Bedrock returns AWS-style errors. Debugging production issues meant reading raw HTTP responses and matching them to provider documentation.

### The Solution: Typed Error Classification

```typescript
import {
  AuthenticationError,
  InvalidModelError,
  NetworkError,
  RateLimitError,
} from '@juspay/neurolink';

try {
  const result = await neurolink.generate({
    input: { text: 'Analyze this transaction' },
    provider: 'openai',
    model: 'gpt-5.4',
  });
} catch (error) {
  if (error instanceof RateLimitError || error instanceof NetworkError) {
    // A retry loop can catch these types and apply a bounded backoff policy.
    throw error;
  }

  if (error instanceof AuthenticationError) {
    console.error('Authentication failed -- check provider credentials');
    throw error;
  }

  if (error instanceof InvalidModelError) {
    console.error('Configured model is unavailable', error);
    throw error;
  }

  throw error;
}
```

> **Note:** `ProviderError`, `AuthenticationError`, `RateLimitError`, `InvalidModelError`, and `NetworkError` are public root exports from `@juspay/neurolink`, so callers can narrow failures with `instanceof`.
{: .prompt-info }

Provider implementations classify raw failures into this public type hierarchy. Handle the most specific types first, retry only transient categories, and log the request ID, provider, and model alongside the typed error.

### The Result

Structured errors turn an ambiguous provider failure into a category the application can act on. Rate-limit and network failures may enter a bounded retry path; authentication and invalid-model failures should surface immediately for configuration repair.

## Lesson 4: Observability is not optional

### The Problem

Without instrumentation, teams discover token usage on invoices, describe latency subjectively, and infer error rates from user reports. Cost attribution across features or teams becomes guesswork.

You cannot optimize what you cannot measure. In a regulated environment, incomplete operational records also make internal review harder.

### The Solution: Built-in Observability

NeuroLink exposes observability at three levels:

**OpenTelemetry Integration**: Distributed tracing for every AI request, integrated with your existing observability stack.

```typescript
import {
  flushOpenTelemetry,
  initializeTelemetry,
  shutdownOpenTelemetry,
} from '@juspay/neurolink';

// Configure OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_SERVICE_NAME in the environment.
await initializeTelemetry();
```

For OTLP-only setup, `initializeTelemetry()` reads `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_SERVICE_NAME`. Export traces to Jaeger, Grafana Tempo, Datadog, or another OTLP-compatible backend. The lower-level `initializeOpenTelemetry()` API accepts Langfuse configuration rather than `{ serviceName, endpoint }`.

**Langfuse Integration**: AI-specific monitoring that goes beyond generic tracing. `setLangfuseContext()` and `getLangfuseHealthStatus()` provide prompt versioning, evaluation tracking, and cost breakdowns per prompt template.

**Analytics Middleware**: The `createAnalyticsMiddleware()` function from `src/lib/middleware/builtin/analytics.ts` collects per-request metrics automatically -- token usage, response time, model performance -- without any code changes to your generation calls.

### The Result

Consistent telemetry lets a team attribute usage to features, identify slow prompts, monitor error trends, and retain operational evidence for its own audit and compliance processes.

## Lesson 5: Memory management is critical at scale

### The Problem

Conversation context grows unbounded. A customer support session that lasts 20 turns can accumulate thousands of tokens of context, eventually hitting the model's context window limit. In-memory conversation storage is not persistent across server restarts. And uncleaned conversation state from abandoned sessions creates memory leaks.

### The Solution: Redis-Backed Conversation Memory

```typescript
const neurolink = new NeuroLink({
  conversationMemory: {
    enabled: true,
    enableSummarization: true,
    tokenThreshold: 50_000,
    redisConfig: {
      url: 'redis://localhost:6379',
      ttl: 86_400,
    },
  },
});
```

The `ConversationMemoryManager` in `src/lib/core/conversationMemoryManager.ts` handles in-memory conversations. The `RedisConversationMemoryManager` in `src/lib/core/redisConversationMemoryManager.ts` provides persistent, shared storage that survives restarts and scales across multiple server instances.

Set `enableSummarization` with `tokenThreshold` to compact long conversations before they exhaust the model's context window. `maxSessions` bounds only the in-process memory manager; for Redis-backed sessions, `redisConfig.ttl` controls expiration of inactive session keys.

For applications that need intelligent, long-term memory -- remembering user preferences, past decisions, and context across sessions -- NeuroLink integrates with Juspay's own Hippocampus memory SDK (`@juspay/hippocampus`), initialized via the `memory` field of `conversationMemory` (`src/lib/memory/hippocampusInitializer.ts`).

### The Result

Redis-backed memory preserves conversation state across server restarts and shares it across instances. Hippocampus can add longer-term memory for applications that need context across sessions.

## Lesson 6: Human-in-the-loop for regulated industries

### The Problem

In fintech, an application may prohibit AI from autonomously executing high-risk operations. Whether an action requires human approval depends on the organization's policies and applicable regulation, but refunds, balance changes, or transfers are common candidates for tighter control.

The required application pattern is to pause execution mid-flow, present the proposed action to a human reviewer, wait for approval or rejection, and then resume or abort.

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

HITL provides an approval point for actions the application marks as dangerous. The host application remains responsible for reviewer identity, durable records, policy enforcement, and any audit or compliance requirements.

## Lesson 7: The middleware pattern saves you from code spaghetti

### The Problem

As cross-cutting concerns accumulate, each feature can add more branches to the request pipeline. A `generate()` call wrapped in error handling, timing, validation, caching, and analytics quickly obscures business logic.

### The Solution: Middleware Pipeline

```typescript
const result = await neurolink.generate({
  input: { text: 'Analyze this transaction' },
  middleware: {
    middlewareConfig: {
      analytics: { enabled: true },
      guardrails: { enabled: true },
    },
  },
});
```

The `MiddlewareFactory` in `src/lib/middleware/factory.ts` provides a pipeline behind this per-call `middleware` option. This sample enables analytics and guardrails only; auto-evaluation is another built-in middleware, but it must be enabled separately. Custom model middleware can extend the pipeline for domain-specific needs, and priority ordering controls execution order.

This middleware wraps the language model (via `wrapLanguageModel`), so it can apply to both `generate()` and `stream()` calls. HTTP and application concerns -- rate limiting, request validation, PII handling, authentication, and response caching -- still belong in the surrounding server or application middleware.

### The Result

Model middleware keeps analytics and guardrail logic out of individual generation calls, while the HTTP layer retains responsibility for request-level controls. For a detailed walkthrough of the middleware system, see [The Middleware System: Analytics, Guardrails, and Custom Pipelines](/posts/middleware-system/).

## Key takeaways

| Lesson | Pattern | NeuroLink Feature |
|--------|---------|-------------------|
| Providers go down | Explicit fallback policy | Provider pair + application orchestration |
| One model is not enough | Task-based routing | ModelRouter + workflows |
| Debug needs structure | Typed error handling | Public provider error classes |
| You need visibility | Built-in observability | OpenTelemetry + Langfuse |
| Memory must be managed | External persistence | Redis + Hippocampus |
| Regulation needs humans | HITL workflows | HITLManager |
| Cross-cutting concerns | Middleware pipeline | MiddlewareFactory |

## Conclusion

Production AI is about reliability, not capability. The most capable model is useless if it is down, unmonitored, or unauditable.

The common thread across all seven lessons: production-grade AI is not about the model -- it is about everything around the model. Error handling. Fallback. Observability. Memory management. Human oversight. Cost management. These are the features that determine whether your AI application survives its first month in production.

NeuroLink exposes reusable components for these production concerns, but each application must choose its own reliability, cost, observability, and governance policies.

For audit and compliance patterns, explore our guide on [enterprise security](/posts/enterprise-security-guide/).

---

**Related posts:**

- [Error Handling Patterns for AI Applications](/posts/error-handling-patterns/)
- [LLM Cost Optimization: Practical Strategies to Reduce Your AI Spend](/posts/cost-optimization-strategies/)
- [Multi-Provider Failover: Never Lose an API Call](/posts/provider-failover-patterns/)
