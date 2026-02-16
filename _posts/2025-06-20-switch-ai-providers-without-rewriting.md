---
layout: post
title: How to Switch AI Providers Without Rewriting Code
date: '2025-06-20 10:00:00 +0530'
categories:
  - Tutorial
  - Providers
tags:
  - provider-switching
  - vendor-independence
  - migration
  - neurolink
  - multi-provider
  - typescript
  - abstraction-layer
author: neurolink
description: >-
  Switch between OpenAI, Claude, Gemini, Bedrock, and 9 more AI providers by
  changing a single line of code. A practical tutorial on building
  provider-portable AI applications with NeuroLink.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/switch-ai-providers-without-rewriting/hero.png
  alt: How to Switch AI Providers Without Rewriting Code
---

By the end of this guide, you'll have a provider-portable AI application where switching from OpenAI to Anthropic to Gemini is a single string change -- no rewrites, no refactoring.

You will build your code once with NeuroLink's unified API and learn how to drive provider selection from environment variables, add fallback providers, and migrate an existing single-provider codebase to a portable architecture.

---

## The Problem: Provider Lock-In

Here is what typical provider-specific code looks like:

```typescript
// Locked to OpenAI
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

This code is tightly coupled to OpenAI. The import, the constructor, the method name, the request shape, and the response shape are all OpenAI-specific. If you want to try Anthropic, you need a completely different implementation:

```typescript
// Locked to Anthropic -- entirely different API
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});
```

Different import. Different constructor. Different method. Different request shape. Different response shape. If your application has dozens of AI calls scattered across multiple files, switching providers is a multi-day refactoring project with a high risk of regressions.

This is provider lock-in, and it is the default state of most AI applications today.

---

## The Solution: Provider Abstraction

With NeuroLink, every provider speaks the same API. You write your code once, and switching providers is a string change:

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// OpenAI
const result1 = await neurolink.generate({
  input: { text: 'Explain AI' },
  provider: 'openai',
  model: 'gpt-4o',
});

// Switch to Claude -- same interface, same result shape
const result2 = await neurolink.generate({
  input: { text: 'Explain AI' },
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
});

// Switch to Gemini via Vertex
const result3 = await neurolink.generate({
  input: { text: 'Explain AI' },
  provider: 'vertex',
  model: 'gemini-3-flash',
});
```

> **Note:** Model names and IDs in code examples reflect versions available at time of writing. Model availability, naming conventions, and pricing change frequently. Always verify current model IDs with your provider's documentation before deploying to production.
{: .prompt-info }

All three calls return the same `GenerateResult` type with the same fields: `content`, `usage`, `provider`, `model`, `responseTime`. Your application code that processes the response does not need to know or care which provider generated it.

The same abstraction applies to streaming. `neurolink.stream()` returns a consistent `result.stream` async iterator regardless of whether the provider uses SSE, WebSocket, or HTTP chunking under the hood.

> **Note:** The provider name for Google Vertex AI is `"vertex"`, not `"google-vertex"`. See the full provider reference table below for all config keys.
{: .prompt-info }

---

## Environment-Driven Provider Selection

For maximum portability, let NeuroLink auto-detect the best available provider based on your environment variables:

```typescript
// Let NeuroLink auto-detect the best available provider
import { createBestAIProvider } from '@juspay/neurolink';

const provider = await createBestAIProvider();
// Checks env vars: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, etc.
// Automatically selects the first available provider
```

`createBestAIProvider()` scans your environment in a priority order, detects which API keys are configured, and returns a provider instance ready to use. This is particularly powerful for:

- **Shared libraries:** Your module works regardless of which provider the consumer has configured
- **Multi-environment deployments:** Dev uses Ollama (free, local), staging uses OpenAI, production uses Bedrock
- **Open-source projects:** Contributors can use whichever provider they have access to

You can also drive provider selection from configuration or environment variables at the application level:

```typescript
const result = await neurolink.generate({
  input: { text: 'Hello' },
  provider: process.env.AI_PROVIDER || 'openai',
  model: process.env.AI_MODEL || 'gpt-4o',
});
```

This pattern lets operations teams switch providers through deployment configuration without any code changes.

---

## Portable Streaming

Streaming is where provider differences are most painful. OpenAI uses Server-Sent Events, some providers use WebSocket, others use HTTP chunked transfer. Each has different chunk formats, different error handling, and different reconnection behavior.

NeuroLink normalizes all of this into a single async iterator:

```typescript
// Streaming works identically across all 13 providers
const result = await neurolink.stream({
  input: { text: 'Write a story' },
  provider: process.env.AI_PROVIDER || 'openai',
  model: process.env.AI_MODEL || 'gpt-4o',
});

for await (const chunk of result.stream) {
  if ('content' in chunk) process.stdout.write(chunk.content);
}
```

Whether you are streaming from OpenAI, Anthropic, Google Vertex, AWS Bedrock, or a local Ollama instance, the code is identical. NeuroLink handles the protocol translation internally, so your application layer never needs to think about transport details.

> **Tip:** Using `process.env.AI_PROVIDER` for both `generate()` and `stream()` calls means you can switch your entire application's provider with a single environment variable change.
{: .prompt-tip }

---

## Portable Tool Calling

Tool definitions are another area where providers diverge. OpenAI function calling, Anthropic tool use, and Google function declarations all have different schema formats and execution patterns.

With NeuroLink, define your tools once using Zod schemas and they work with any provider that supports tool calling:

```typescript
import { z } from 'zod';
import { tool } from 'ai';

const myTool = tool({
  description: 'Search the database',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => ({ results: [] }),
});

// Same tool definition works with any provider that supports tools
const result = await neurolink.stream({
  input: { text: 'Search for recent orders' },
  provider: 'anthropic', // or 'openai', 'vertex', etc.
  tools: { search: myTool },
});
```

The Zod schema defines the tool parameters with full TypeScript type inference. NeuroLink converts it to the appropriate format for each provider -- JSON Schema for OpenAI, function declarations for Google, tool use format for Anthropic. Your tool definitions are written once and work everywhere.

---

## All 13 Supported Providers

Here is the complete reference for every provider NeuroLink supports:

| Provider | Config Key | Environment Variable |
|---|---|---|
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` |
| Google Vertex AI | `vertex` | `VERTEX_PROJECT_ID` |
| AWS Bedrock | `bedrock` | AWS credentials |
| Azure OpenAI | `azure` | `AZURE_OPENAI_API_KEY` |
| Google AI Studio | `google-ai` | `GOOGLE_API_KEY` |
| Mistral | `mistral` | `MISTRAL_API_KEY` |
| Ollama | `ollama` | _(local, no key)_ |
| LiteLLM | `litellm` | `LITELLM_API_KEY` |
| Hugging Face | `huggingface` | `HUGGINGFACE_API_KEY` |
| AWS SageMaker | `sagemaker` | AWS credentials |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` |
| OpenAI-Compatible | `openai-compatible` | Configurable |

Every provider in this table is accessible through the same `generate()` and `stream()` interface. The `AIProviderName` enum in NeuroLink's source code defines these as the canonical provider identifiers.

---

## A Migration Strategy: From Single-Provider to Portable

If your application is currently locked to a single provider, here is a practical migration path:

### Step 1: Replace Direct SDK Calls

Find every direct provider SDK call and replace it with a NeuroLink call:

```typescript
// Before: locked to OpenAI
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
});
const text = response.choices[0].message.content;

// After: provider-portable
const result = await neurolink.generate({
  input: { text: prompt },
  provider: 'openai',
  model: 'gpt-4o',
});
const text = result.content;
```

### Step 2: Extract Provider Configuration

Move provider and model strings to environment variables or configuration:

```typescript
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o';

const result = await neurolink.generate({
  input: { text: prompt },
  provider: AI_PROVIDER,
  model: AI_MODEL,
});
```

### Step 3: Add a Fallback Provider

Configure a second provider for resilience:

```typescript
import { createAIProviderWithFallback } from '@juspay/neurolink';

const { primary, fallback } = await createAIProviderWithFallback(
  'openai',
  'bedrock'
);
```

### Step 4: Test Across Providers

Run your test suite against multiple providers to verify consistent behavior. NeuroLink's unified result types make assertions portable too.

---

## What's Next

You now have a provider-portable codebase. Here is the migration path you followed:

1. Replace direct SDK calls with NeuroLink's unified `generate()` and `stream()`
2. Extract provider and model into environment variables
3. Add a fallback provider for resilience
4. Test across providers to verify consistent behavior

Your next step: pick one file in your current codebase that makes direct provider calls, replace it with the NeuroLink pattern, and set the provider via environment variable. Once that works, repeat for the rest.

---

**Related posts:**

- [Multi-Provider Failover: Never Lose an API Call](/posts/provider-failover-patterns/)
- [What is NeuroLink? The Unified AI SDK Explained](/posts/what-is-neurolink-unified-sdk/)
- [Getting Started with NeuroLink: Your First AI App in 5 Minutes](/posts/getting-started-first-ai-app/)
