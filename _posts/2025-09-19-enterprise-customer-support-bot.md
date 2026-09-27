---
layout: post
title: Building an Enterprise Customer Support Bot That Never Goes Down
date: '2025-09-19 10:00:00 +0530'
categories:
  - Use Case
  - Enterprise
tags:
  - customer-support
  - chatbot
  - high-availability
  - circuit-breaker
  - fallback
  - multi-provider
  - neurolink
author: neurolink
description: >-
  Build an enterprise customer support bot that never goes down using
  NeuroLink's multi-provider fallback, circuit breakers, and rate limiting.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/enterprise-customer-support-bot/hero.png
  alt: Building an Enterprise Customer Support Bot That Never Goes Down
---

You will build an enterprise customer support bot with 99.9% uptime using NeuroLink's multi-provider fallback, circuit breakers, rate limiting, and conversation memory. By the end of this tutorial, your bot will automatically switch providers during outages, maintain session continuity across switches, and handle zero-downtime deployments.

> **Note:** The 99.9% uptime target refers specifically to the AI provider availability layer (achieved through multi-provider failover). Overall system uptime depends on all infrastructure components — databases, networking, deployment platform, and monitoring. A comprehensive SLA requires end-to-end reliability engineering beyond the AI layer.
{: .prompt-info }

## High-availability architecture

Start by understanding the architecture that makes 99.9% uptime achievable. The key insight: every component has a fallback, and every fallback has a fallback.

```mermaid
flowchart TB
    Customer[Customer] --> LB[Load Balancer]
    LB --> Bot[Support Bot Service]

    Bot --> Primary[Primary Provider<br/>Vertex Gemini Pro]
    Bot --> Secondary[Secondary Provider<br/>OpenAI GPT-5.4]
    Bot --> Tertiary[Tertiary Provider<br/>Bedrock Claude]
    Bot --> Emergency[Emergency Provider<br/>Ollama Local]

    Primary --> CB1[Circuit Breaker]
    Secondary --> CB2[Circuit Breaker]
    Tertiary --> CB3[Circuit Breaker]

    CB1 -->|Open| Secondary
    CB2 -->|Open| Tertiary
    CB3 -->|Open| Emergency

    Bot --> Memory[Conversation Memory<br/>Session Continuity]
    Bot --> RL[Rate Limiter<br/>API Budget Control]

    subgraph Resilience Layer
        CB1
        CB2
        CB3
        RL
    end
```

The architecture centers on a fallback chain pattern. Each provider in the chain is wrapped in a circuit breaker (created via `CircuitBreakerManager`) that monitors its health in real time. When a provider starts failing (three consecutive failures by default), the circuit breaker "opens" and all traffic is immediately routed to the next provider in the chain. No manual intervention required.

The `CircuitBreakerManager` from NeuroLink coordinates all breakers centrally. It tracks which providers are healthy, which are in recovery (half-open state), and which are completely down. The emergency fallback to Ollama running locally ensures that even if every cloud provider is down simultaneously, customers still get responses -- perhaps slower, perhaps less sophisticated, but never silence.

External tool integrations such as CRM lookups and ticket creation are similarly protected by `MCPCircuitBreaker`, ensuring that a flaky third-party API does not cascade into a full system failure.

## Multi-provider fallback chain

The core of our resilience strategy is the provider cascade. Each provider gets its own circuit breaker configuration tuned to its characteristics. A cloud provider with lower latency expectations gets a tighter timeout. A more reliable but slower provider gets a higher failure threshold.

```typescript
import {
  AIProviderFactory,
  withRetry,
  CircuitBreakerManager,
} from '@juspay/neurolink';

const cbManager = new CircuitBreakerManager();

// Create circuit breakers for each provider
const vertexBreaker = cbManager.getBreaker("vertex", {
  failureThreshold: 3,
  resetTimeout: 30000,
  halfOpenMaxCalls: 2,
  operationTimeout: 15000,
});
const openaiBreaker = cbManager.getBreaker("openai", {
  failureThreshold: 3,
  resetTimeout: 30000,
});
const bedrockBreaker = cbManager.getBreaker("bedrock", {
  failureThreshold: 5,
  resetTimeout: 60000,
});

// Provider cascade with circuit breakers
async function getResponse(userMessage: string, sessionId: string) {
  const providers = [
    { name: "vertex", model: "gemini-2.5-pro", breaker: vertexBreaker },
    { name: "openai", model: "gpt-5.4", breaker: openaiBreaker },
    { name: "bedrock", model: null, breaker: bedrockBreaker },
    { name: "ollama", model: "llama3.1:8b", breaker: null }, // No breaker for local
  ];

  for (const { name, model, breaker } of providers) {
    try {
      const provider = await AIProviderFactory.createProvider(name, model);

      const execute = () => withRetry(
        () => provider.generate({
          input: { text: userMessage },
          context: { sessionId }, // Use session for conversation continuity
          disableTools: false,
        }),
        { maxRetries: 1, baseDelayMs: 1000 }
      );

      const result = breaker
        ? await breaker.execute(execute)
        : await execute();

      return { response: result, provider: name };
    } catch (error) {
      console.warn(`Provider ${name} failed, trying next...`);
      continue;
    }
  }

  return {
    response: "We're experiencing issues. A human agent will assist you shortly.",
    provider: "fallback",
  };
}
```

Let us break down what is happening here. The `CircuitBreakerManager` manages multiple breakers through a single interface. Each breaker tracks the health of its provider using a state machine with three states:

- **Closed** (healthy): Requests pass through normally. Failures are counted.
- **Open** (unhealthy): After `failureThreshold` consecutive failures, the breaker opens. All requests immediately fail without calling the provider, enabling instant fallback to the next provider in the chain.
- **Half-open** (recovering): After `resetTimeout` milliseconds, the breaker allows `halfOpenMaxCalls` test requests through. If they succeed, the breaker closes again. If they fail, it reopens.

The `withRetry` wrapper adds an additional layer: each individual call gets up to one retry (`maxRetries: 1`) after a one-second base delay (`baseDelayMs: 1000`), with exponential backoff on further attempts. This handles transient network blips without triggering the circuit breaker for temporary issues.

The Ollama emergency fallback has no circuit breaker because it is running locally. If the local model is down, the entire machine is likely down, and no amount of circuit breaking will help.

> **Tip:** Call `getHealthSummary()` on your `CircuitBreakerManager` to get a snapshot of all breaker states. Feed this into your monitoring dashboard for real-time visibility.
{: .prompt-tip }

## Conversation memory for session continuity

Next, you will add conversation memory so customers never notice a provider switch. NeuroLink stores conversation history independently of the provider, so any provider can pick up where the last one left off.

```typescript
// Environment configuration
process.env.NEUROLINK_MEMORY_ENABLED = "true";
process.env.NEUROLINK_MEMORY_MAX_SESSIONS = "10000";
process.env.NEUROLINK_SUMMARIZATION_ENABLED = "true";
process.env.NEUROLINK_TOKEN_THRESHOLD = "100000";

// From NeuroLink's conversation memory configuration:
// MEMORY_THRESHOLD_PERCENTAGE = 0.8 -- triggers summarization at 80% of context
// RECENT_MESSAGES_RATIO = 0.3 -- keeps 30% as recent, summarizes 70%
// CONVERSATION_INSTRUCTIONS appended to system prompt for context awareness
```

The memory system is token-aware. When a conversation grows long -- as support conversations often do, with back-and-forth troubleshooting -- the system automatically summarizes older messages when the conversation exceeds 80% of the model's context window. The 30% most recent messages are preserved verbatim to maintain immediate context, while the older 70% gets condensed into a summary.

This means a customer who has been going back and forth for thirty messages does not lose context, but the system also does not burn excessive tokens sending the entire history to the LLM on every turn.

When structured output is needed (for example, when the bot creates a support ticket), `STRUCTURED_OUTPUT_INSTRUCTIONS` are appended to ensure the LLM returns clean JSON that can be parsed programmatically and fed directly into your ticketing system.

## Rate limiting and cost control

Now you will add rate limiting and cost control. Your bot needs to handle burst traffic during outages without bankrupting the company on API costs.

```typescript
// NeuroLink does not export a generic rate limiter from its public API --
// this sliding-window limiter is plain application code, following the
// same pattern NeuroLink uses internally.
class RateLimiter {
  private requests: number[] = [];
  constructor(private maxRequests: number, private windowMs: number) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.windowMs);
    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.requests[0]);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.requests.push(Date.now());
  }
}

// Per-customer rate limiter
const customerLimiters = new Map<string, RateLimiter>();

function getCustomerLimiter(customerId: string): RateLimiter {
  if (!customerLimiters.has(customerId)) {
    customerLimiters.set(customerId, new RateLimiter(20, 60000)); // 20 msgs/min
  }
  return customerLimiters.get(customerId)!;
}

// Cost tracking per interaction, using the public analytics field
const result = await neurolink.generate({
  input: { text: userMessage },
  provider: "vertex",
  model: "gemini-2.5-pro",
  enableAnalytics: true,
});
console.log("Cost for this request:", result.analytics?.cost);
```

The rate limiter uses a sliding window algorithm, allowing 20 messages per minute per customer by default. This prevents a single automated client from consuming your entire API budget while still allowing normal human conversation rates.

Cost optimization goes further with intelligent routing. Simple queries like "What are your business hours?" do not need GPT-5.4. Route them to a fast, cheap model and save the expensive reasoning models for complex troubleshooting:

```typescript
async function routeByComplexity(message: string, sessionId: string) {
  const isSimple = message.length < 100;

  if (isSimple) {
    // Fast tier
    return neurolink.generate({
      input: { text: message },
      context: { sessionId },
      provider: "vertex",
      model: "gemini-2.5-flash",
    });
  }

  // Quality tier
  return neurolink.generate({
    input: { text: message },
    context: { sessionId },
    provider: "vertex",
    model: "gemini-2.5-pro",
  });
}
```

## MCP tool integration for CRM access

Next, you will connect your bot to real backend systems. NeuroLink's MCP integration provides a standardized tool interface for CRM lookups, ticket creation, and knowledge base search.

```typescript
import { NeuroLink } from '@juspay/neurolink';
import { z } from 'zod';

const neurolink = new NeuroLink();

// Register CRM and knowledge base tools
neurolink.registerTool('lookupCustomer', {
  name: 'lookupCustomer',
  description: 'Look up a customer record in the CRM by ID or email',
  inputSchema: z.object({
    customerId: z.string().optional(),
    email: z.string().optional(),
  }),
  execute: async ({ customerId, email }) => crm.lookupCustomer({ customerId, email }),
});

neurolink.registerTool('createTicket', {
  name: 'createTicket',
  description: 'Create a support ticket for the customer',
  inputSchema: z.object({
    customerId: z.string(),
    summary: z.string(),
  }),
  execute: async ({ customerId, summary }) => crm.createTicket({ customerId, summary }),
});

neurolink.registerTool('searchArticles', {
  name: 'searchArticles',
  description: 'Search the internal knowledge base for relevant articles',
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => knowledgeBase.search(query),
});
```

`registerTool()` makes each tool available on every subsequent `generate()`/`stream()` call. Each tool server (CRM, knowledge base, ticketing system) is registered with its own description and Zod input schema. When the LLM decides it needs to look up a customer record, it calls `lookupCustomer`, which routes the call to the appropriate backend.

Each tool call is wrapped with `MCPCircuitBreaker` for fault tolerance. If your CRM API starts timing out, the circuit breaker prevents the support bot from hanging on every request. Instead, the bot gracefully acknowledges that it cannot access customer data at the moment and offers alternative help.

## Monitoring and health checks

You will now add health monitoring so you can maintain 99.9% uptime with full visibility into provider health.

```typescript
// Health check endpoint
app.get("/health", (req, res) => {
  const health = cbManager.getHealthSummary();
  const stats = {
    ...health,
    memoryEnabled: process.env.NEUROLINK_MEMORY_ENABLED === "true",
    providers: cbManager.getBreakerNames().map(name => ({
      name,
      ...cbManager.getBreaker(name).getStats(),
    })),
  };
  const status = health.openBreakers > 2 ? 503 : 200;
  res.status(status).json(stats);
});
```

The health check returns detailed statistics for each provider: current circuit breaker state, total call count, failure rate, and next retry time for open breakers. When more than two breakers are open (meaning three of your four providers are down), the endpoint returns a 503, triggering your load balancer to route traffic to backup instances or alerting your operations team.

Each breaker's `getStats()` returns a `CircuitBreakerStats` object with `state`, `totalCalls`, `failureRate`, and `nextRetryTime`. Feed these into Grafana, Datadog, or your preferred observability platform for real-time dashboards.

## Graceful shutdown

Finally, you will add graceful shutdown for zero-downtime deployments. The shutdown tracker below ensures in-flight conversations complete before the old instance shuts down.

```typescript
// NeuroLink does not export a shutdown tracker from its public API --
// this mirrors the same in-flight-promise-tracking pattern NeuroLink
// uses internally, implemented as plain application code.
class GracefulShutdown {
  private operations = new Set<Promise<unknown>>();

  track<T>(operation: Promise<T>): Promise<T> {
    this.operations.add(operation);
    operation.finally(() => this.operations.delete(operation));
    return operation;
  }

  async shutdown(timeoutMs = 30000): Promise<void> {
    await Promise.race([
      Promise.all(this.operations),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Shutdown timeout")), timeoutMs),
      ),
    ]).catch((error) => console.warn("Shutdown warning:", error.message));
  }
}

const shutdown = new GracefulShutdown();

// Track in-flight requests
app.use((req, res, next) => {
  const promise = handleRequest(req, res);
  shutdown.track(promise);
  next();
});

// Clean shutdown
process.on("SIGTERM", async () => {
  await shutdown.shutdown(30000); // 30s grace period
  cbManager.destroyAll(); // Clean up circuit breakers
  process.exit(0);
});
```

When a SIGTERM signal arrives (standard for Kubernetes rolling deployments), the shutdown handler waits up to 30 seconds for all tracked in-flight requests to complete. No customer mid-sentence gets an abrupt disconnection. After all requests finish (or the grace period expires), `cbManager.destroyAll()` cleans up all circuit breaker timers and event listeners, preventing memory leaks during shutdown.

## Putting it all together

Here is what the complete support bot looks like when all the pieces come together:

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink({
  conversationMemory: { enabled: true },
  hitl: {
    enabled: true,
    dangerousActions: ['refund', 'account-delete', 'escalate-manager'],
    timeout: 60000,
    autoApproveOnTimeout: false,
  },
});

// Every customer message flows through:
// 1. Rate limiter - prevents abuse
// 2. Provider cascade - tries Vertex, OpenAI, Bedrock, Ollama in order
// 3. Circuit breakers - skips unhealthy providers instantly
// 4. Conversation memory - maintains context across provider switches
// 5. MCP tools - accesses CRM, knowledge base, ticketing
// 6. HITL - requires human approval for refunds and account deletions
// 7. Health monitoring - exposes status for operational visibility
```

> **Warning:** Always set `autoApproveOnTimeout: false` for sensitive actions. A timed-out approval should route to a human agent, never auto-approve a refund or account deletion.
{: .prompt-warning }

## What you built and what's next

You built a support bot with multi-provider failover, circuit breakers, conversation memory, rate limiting, MCP tool integration, and graceful shutdown. To extend this architecture:

- Add multi-agent orchestration for routing different query types to specialized agents
- Set up [production error handling](/posts/error-handling-patterns/) for resilient operations
- Implement [enterprise security patterns](/posts/enterprise-security-guide/) for compliance in regulated industries

---

**Related posts:**

- [Error Handling Patterns for AI Applications](/posts/error-handling-patterns/)
- [Multi-Provider Failover: Never Lose an API Call](/posts/provider-failover-patterns/)
- [Conversation Memory: Building Stateful AI Applications](/posts/conversation-memory-guide/)
