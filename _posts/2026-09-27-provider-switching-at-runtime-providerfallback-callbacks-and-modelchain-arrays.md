---
layout: post
title: 'Provider switching at runtime: providerFallback callbacks and modelChain arrays'
date: '2026-09-27 00:05:00 +0530'
categories:
  - Tutorial
tags:
  - neurolink
author: neurolink
description: >-
  How NeuroLink's modelChain retries other models on the same provider, how providerFallback lets your code choose the next provider and model when a call fails, and how to configure, override and test both.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/provider-switching-at-runtime-providerfallback-callbacks-and-modelchain-arrays/hero.png
  alt: 'Provider switching at runtime: providerFallback callbacks and modelChain arrays'
---
Picture a Friday night: one provider's authentication-token rotation fails, and every call to that provider starts returning 401s. The model is fine, but with no mechanism to switch to another provider automatically, a user-facing feature goes down with it. NeuroLink's fallback primitives, `modelChain` and `providerFallback`, exist for exactly this. They give you two ways — one narrow, one general-purpose — to keep a single provider or model failure from becoming a full outage.

## The Single Point of Failure

Every AI application relies on an external provider. That provider can fail. It can be a network blip, a 503 error during a capacity crunch, a rate limit, or a simple configuration error like an expired API key. Other common causes include regional DNS resolution failures, expired SSL certificates on the provider's end, or internal load balancer issues that don't get reflected as a clean HTTP status code.

When you have a single provider wired directly, any one of these issues brings your feature to a halt. This direct approach is the simplest possible way to get a result: send the request to one provider, and either get a result back or catch an error. There is no in-between.

```javascript
// A standard generate call, talking to one provider directly.
// What happens if this provider has an outage?
const result = await neurolink.generate({
  provider: 'openai',
  model: 'gpt-5.4',
  input: { text: 'Summarize this customer feedback...' },
});

// If the call fails, this line is never reached.
console.log(result.content);
```

Without a fallback strategy, the error from the provider API bubbles all the way up. Your application throws an exception, the user sees an error message, and your on-call team gets a page. A robust system anticipates these failures and has a plan to route around them, preserving the user experience.

## The Simplest Fallback: `modelChain`

Sometimes the provider is healthy but the specific *model* isn't available to you: a preview model your account hasn't been granted access to yet, a deprecated snapshot, or a tier limit on a particular SKU. For exactly this failure mode, NeuroLink has `modelChain`: an ordered list of model names, on the *same provider*, that NeuroLink tries in sequence when the current model comes back with a model-access-denied error. The current provider is preserved across the whole chain — only the model name changes — and the rest of the original request (prompt, tools, everything else) is resent unmodified.

You can set a default `modelChain` for all requests in the `NeurolinkConstructorConfig`.

```javascript
import { NeuroLink } from '@juspay/neurolink';

// Configure a default modelChain at initialization.
const neurolink = new NeuroLink({
  credentials: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
  modelChain: ['gpt-5.4', 'gpt-5.4-mini'],
});

async function summarizeWithFallback(text) {
  const result = await neurolink.generate({
    provider: 'openai',
    input: { text: `Summarize: ${text}` },
  });
  return result.content;
}
```

If `gpt-5.4` comes back with a model-access error, NeuroLink transparently retries the exact same request against `gpt-5.4-mini`, still on your OpenAI credentials. The application code stays unaware of the substitution.

It's worth being precise about what `modelChain` does *not* do. Without an explicit `providerFallback` callback set alongside it, the chain only advances on that one error class — a network error, a 5xx, or a timeout on `gpt-5.4` bubbles straight up instead of moving on to `gpt-5.4-mini`, and the provider itself never changes. `modelChain` is a narrow, zero-code tool for "is this exact model reachable on my account," not a general outage switch. For the Friday-night, one-provider-is-down failure from the introduction, you need `providerFallback` — which is where real cross-provider control lives, covered next.

## What Happens Before a Fallback?

Before giving up on the current provider, NeuroLink first retries the same request against that same provider a couple of times with exponential backoff. This absorbs purely transient failures — a passing rate limit or a brief 5xx — without paying the cost of a full model or provider switch. Only once those in-place retries are exhausted does NeuroLink treat the provider as unavailable and hand off to whatever fallback you've configured, via `modelChain` or `providerFallback`.

## Full Control with `providerFallback`

`modelChain` is great for narrow model-access issues, but sometimes you need more: switch to a cheaper model for a non-critical task, log the failure to your observability platform, or decide not to fall back at all depending on the error. `providerFallback` is the async callback for this. You supply it in the `NeurolinkConstructorConfig` — its type is `ProviderFallbackCallback`. NeuroLink invokes it for essentially any failure short of a genuine caller cancellation: network errors, rate limits, server errors, timeouts, auth failures, and model-access-denied all trigger it. It receives the original error, unmodified, and must return the next `{ provider, model }` to try (either field is optional), or `null` to stop and let the error propagate.

```javascript
import { NeuroLink } from '@juspay/neurolink';

// type ProviderFallbackCallback = (
//   error: unknown,
// ) => Promise<{ provider?: string; model?: string } | null>;

// NeuroLink passes the error through unmodified, so classifying it is on
// you. Its own hand-rolled clients stamp `.statusCode`; official provider
// SDKs (e.g. @anthropic-ai/sdk) expose `.status` instead.
function getStatusCode(error) {
  if (error && typeof error === 'object') {
    return error.statusCode ?? error.status;
  }
  return undefined;
}

const neurolink = new NeuroLink({
  credentials: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    googleAiStudio: { apiKey: process.env.GOOGLE_AI_API_KEY },
  },
  providerFallback: async (error) => {
    console.warn('A provider call failed. Evaluating fallback options.', {
      error,
    });

    const statusCode = getStatusCode(error);

    // For authentication failures, that provider is dead to us.
    // Switch to a different provider entirely and don't look back.
    if (statusCode === 401 || statusCode === 403) {
      return { provider: 'anthropic', model: 'claude-sonnet-5' };
    }

    // For rate limits or temporary server issues, fall back to a
    // smaller, faster model on a different provider.
    if (statusCode === 429 || (statusCode && statusCode >= 500)) {
      return { provider: 'google', model: 'gemini-2.5-flash' };
    }

    // For any other error, we don't have a specific strategy.
    // Return null to stop and let the error propagate.
    return null;
  },
});
```

Note the credentials go under `credentials`, not `auth` — `auth` on `NeurolinkConstructorConfig` configures end-user authentication (Auth0, Clerk, and similar identity providers), which is a separate concern from the LLM API keys used here. This callback gives you fine-grained, programmatic control over your application's resilience logic. You could even integrate it with a feature flag service or a real-time [model grading pipeline](/posts/grading-the-model-the-scorer-hierarchy-and-evaluation-pipeline/) to make dynamic decisions about the best fallback target.

## Overriding Fallbacks Per-Request

Global configuration is powerful, but not every request has the same priority. A background summarization task has very different resilience requirements from a customer-facing chatbot. For the former, failing fast might be preferable to incurring costs on a premium model. For the latter, you want to do everything possible to generate a response.

Both `modelChain` and `providerFallback` can be overridden on a per-call basis by passing them in `GenerateOptions`: a per-request `providerFallback` overrides the instance-level callback, and a per-request `modelChain` overrides the instance-level chain.

```javascript
// For a high-priority, interactive chat, fall back to another Anthropic
// model if claude-opus-5 isn't available on this account.
const chatReply = await neurolink.generate({
  provider: 'anthropic',
  model: 'claude-opus-5',
  input: { text: 'You are a helpful assistant...' },
  modelChain: ['claude-sonnet-5'],
});

// For a low-priority background job, fail fast instead of spending more.
const backgroundJob = await neurolink.generate({
  provider: 'google',
  model: 'gemini-2.5-flash',
  input: { text: 'Extract keywords from this text...' },
  providerFallback: async (error) => {
    console.error('Background job provider failed', error);
    return null;
  },
});
```

This pattern of global configuration with per-request overrides is a core design principle in NeuroLink. It provides a robust default behavior while giving developers the flexibility to handle exceptions for specific use cases — the same philosophy we apply to components like our [conversation memory backends](/posts/inside-conversationmemoryfactory-how-neurolink-picks-and-wires-a-memory-backend/). Reach for `modelChain` when the risk is a specific model becoming unavailable on a provider you already trust, and reach for `providerFallback` when you need to route around the provider itself — across NeuroLink's growing catalog of provider adapters — or apply custom logic to the decision. Combining both gives you resilient AI applications that withstand the inevitable failures of distributed systems.

## Choosing Between `modelChain` and `providerFallback`

| Question | `modelChain` | `providerFallback` |
|---|---|---|
| What moves it to the next attempt? | A model-access-denied error (unless a callback is also set) | Any error except a genuine caller cancellation: network errors, 5xx, timeouts, auth failures, model access |
| Can the provider change? | No — the current provider is kept; only the model name changes | Yes — return any `{ provider, model }` |
| What do you write? | An ordered array of model names | An async function that receives the error |
| Where can you set it? | `new NeuroLink({ modelChain })` or per call in `generate()` | `new NeuroLink({ providerFallback })` or per call in `generate()` |
| How does it end? | After the last model in the array | When your callback returns `null` |

## Testing Your Fallback Logic

Because `providerFallback` is an ordinary async function, the policy is easiest to trust when it lives in its own module and is tested like any other error path. Here is the same policy as above, extracted:

```typescript
// fallback.ts
export function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const e = error as { statusCode?: number; status?: number };
    return e.statusCode ?? e.status;
  }
  return undefined;
}

export async function chooseFallback(
  error: unknown,
): Promise<{ provider?: string; model?: string } | null> {
  const statusCode = getStatusCode(error);
  if (statusCode === 401 || statusCode === 403) {
    return { provider: 'anthropic', model: 'claude-sonnet-5' };
  }
  if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
    return { provider: 'google', model: 'gemini-2.5-flash' };
  }
  return null;
}
```

Wire it into the constructor exactly as before:

```typescript
// app.ts
import { NeuroLink } from '@juspay/neurolink';
import { chooseFallback } from './fallback';

const neurolink = new NeuroLink({
  credentials: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    googleAiStudio: { apiKey: process.env.GOOGLE_AI_API_KEY },
  },
  providerFallback: chooseFallback,
});
```

And cover each branch with fake errors — no network calls needed:

```typescript
// fallback.test.ts
import { describe, expect, it } from 'vitest';
import { chooseFallback } from './fallback';

describe('chooseFallback', () => {
  it('switches provider on an authentication failure', async () => {
    await expect(chooseFallback({ status: 401 })).resolves.toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
    });
  });

  it('moves to a faster model on a rate limit or server error', async () => {
    await expect(chooseFallback({ statusCode: 503 })).resolves.toEqual({
      provider: 'google',
      model: 'gemini-2.5-flash',
    });
  });

  it('lets errors a retry cannot fix propagate', async () => {
    await expect(chooseFallback({ status: 400 })).resolves.toBeNull();
    await expect(chooseFallback(new Error('boom'))).resolves.toBeNull();
  });
});
```

## A Checklist Before You Ship Fallbacks

- Make sure every provider your callback can return has credentials, either under `credentials` on the constructor or in environment variables. Per-call credentials fall through to instance credentials, then to the environment.
- Keep fallback targets in the same capability tier as the primary. A model without tool calling or structured output can turn a recoverable outage into a quieter correctness bug.
- Return `null` for errors that a different model cannot fix, such as a malformed request, rather than resending the same bad input elsewhere.
- Log the original error inside `providerFallback` before choosing a target, so an outage on the primary stays visible even when users never notice it.
- Test every branch of the callback the way the example above does, including the `null` path.

---

**Related posts:**

- [Two decision providers, one decide(): what Laya forced on NeuroLink](/posts/two-decision-providers-one-decide-what-laya-forced-on-neurolink/)
- [Twenty-four providers, one BaseProvider: the adapter catalog](/posts/twenty-four-providers-one-baseprovider-the-adapter-catalog/)
- [Two backends, two stores, one TaskManager: how NeuroLink schedules AI work](/posts/two-backends-two-stores-one-taskmanager-how-neurolink-schedules-ai-work/)
