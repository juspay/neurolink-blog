---
layout: post
title: "Migrating from Vercel AI SDK to NeuroLink"
date: 2025-07-26 10:00:00 +0530
last_updated: 2026-01-15
categories: [Migration, Tutorial]
tags: [vercel-ai, migration, nextjs, streaming]
author: neurolink
description: "Complete guide to migrating from Vercel AI SDK to NeuroLink. Learn streaming patterns, API routes, and Next.js integration with working code examples."
toc: true
mermaid: true
pin: false
---

The Vercel AI SDK has been a popular choice for building AI-powered applications with Next.js. However, as your application grows and requirements evolve, you may need more flexibility, better provider support, or unified streaming capabilities. NeuroLink offers all of this while maintaining a clean developer experience. This guide walks you through migrating your Vercel AI SDK implementation to NeuroLink.

**Verification Details:** This migration guide was verified with NeuroLink v8.32.0 and Vercel AI SDK v5.x.

## Why Migrate from Vercel AI SDK?

Before diving into the migration process, let's understand why teams choose to migrate from Vercel AI SDK to NeuroLink:

### Provider Flexibility

While Vercel AI SDK supports multiple providers, NeuroLink offers unified access to 13 providers through a single API. Switch between OpenAI, Anthropic, Google, Mistral, and other providers without changing your application code.

### Cost Optimization

NeuroLink's cost optimization features can significantly reduce costs through:
- Automatic cheapest model selection
- Intelligent provider routing
- Cost-aware fallback strategies

> **Note:** Actual savings depend on your usage patterns. NeuroLink provides the
> tooling for cost optimization - configure based on your requirements.

### Enhanced Streaming

NeuroLink provides consistent streaming behavior across all providers, including those that don't natively support streaming. You get the same streaming API whether you're using GPT-4, Claude, or Llama.

### Production Features

Built-in rate limiting, automatic retries, request queuing, and comprehensive observability come standard with NeuroLink, features that often require additional infrastructure with Vercel AI SDK.

> **Note on AI SDK 6:** Vercel released AI SDK 6 in December 2025 with significant
> new capabilities including full MCP (Model Context Protocol) support, an Agent
> abstraction for building reusable agents, and DevTools integration. With over
> 20 million monthly downloads, the AI SDK continues to evolve. Evaluate your
> specific requirements - if MCP support or the new agent patterns are critical
> to your use case, compare both SDKs' implementations before deciding on your
> migration path.
{: .prompt-info }

## Understanding the Architecture Differences

### Vercel AI SDK Architecture

The Vercel AI SDK typically follows this pattern:

```typescript
// Vercel AI SDK pattern
import { OpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Direct provider coupling
const result = await generateText({
  model: openai('gpt-4'),
  prompt: 'Hello, world!',
});
```

### NeuroLink Architecture

NeuroLink abstracts the provider layer with a clean, unified API:

```typescript
// NeuroLink pattern
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Provider-agnostic - specify provider and model separately
const result = await neurolink.generate({
  input: { text: 'Hello, world!' },
  provider: 'openai',
  model: 'gpt-4',
});
```

## Step-by-Step Migration Guide

### Step 1: Install NeuroLink SDK

First, install the NeuroLink SDK alongside your existing Vercel AI SDK installation:

```bash
npm install @juspay/neurolink
# or
yarn add @juspay/neurolink
# or
pnpm add @juspay/neurolink
```

### Step 2: Configure Environment Variables

Add your NeuroLink API key to your environment:

```bash
# .env.local
NEUROLINK_API_KEY=your_neurolink_api_key_here

# You can keep existing keys during migration
OPENAI_API_KEY=your_openai_key  # Optional: for comparison
```

### Step 3: Create the NeuroLink Client

Create a centralized client configuration:

```typescript
// lib/neurolink.ts
import { NeuroLink } from '@juspay/neurolink';

export const neurolink = new NeuroLink();
```

## Migrating Core Patterns

### Text Generation Migration

**Vercel AI SDK (Before):**

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function generateResponse(prompt: string) {
  const { text } = await generateText({
    model: openai('gpt-4'),
    prompt,
    maxTokens: 1000,
    temperature: 0.7,
  });

  return text;
}
```

**NeuroLink (After):**

```typescript
import { neurolink } from '@/lib/neurolink';

async function generateResponse(prompt: string) {
  const result = await neurolink.generate({
    input: { text: prompt },
    provider: 'openai',
    model: 'gpt-4',
    maxTokens: 1000,
    temperature: 0.7,
  });

  return result.content;
}
```

### Streaming Text Migration

Streaming is where NeuroLink shines, providing consistent behavior across all providers.

**Vercel AI SDK (Before):**

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function streamResponse(prompt: string) {
  const result = await streamText({
    model: openai('gpt-4'),
    prompt,
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
}
```

**NeuroLink (After):**

```typescript
import { neurolink } from '@/lib/neurolink';

async function streamResponse(prompt: string) {
  const result = await neurolink.stream({
    input: { text: prompt },
    provider: 'openai',
    model: 'gpt-4',
  });

  for await (const chunk of result.stream) {
    process.stdout.write(chunk.content);
  }
}
```

### Chat Conversations Migration

**Vercel AI SDK (Before):**

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

async function chat(messages: Message[]) {
  const { text } = await generateText({
    model: openai('gpt-4'),
    messages,
  });

  return text;
}
```

**NeuroLink (After):**

```typescript
import { neurolink } from '@/lib/neurolink';
import type { ChatMessage } from '@juspay/neurolink';

async function chat(messages: ChatMessage[]) {
  const result = await neurolink.generate({
    input: { text: messages[messages.length - 1].content },
    conversationMessages: messages,
    provider: 'openai',
    model: 'gpt-4',
  });

  return result.content;
}
```

## Next.js API Routes Migration

### Basic API Route

**Vercel AI SDK (Before):**

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4'),
    messages,
  });

  return result.toAIStreamResponse();
}
```

**NeuroLink (After):**

```typescript
// app/api/chat/route.ts
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = await neurolink.stream({
    input: { text: prompt },
    provider: 'openai',
    model: 'gpt-4',
  });

  // Convert to ReadableStream for Response
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        controller.enqueue(encoder.encode(chunk.content));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### Non-Streaming API Route

```typescript
// app/api/generate/route.ts
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = await neurolink.generate({
    input: { text: prompt },
    provider: 'openai',
    model: 'gpt-4',
  });

  return Response.json({ result });
}
```

## Server Actions Migration

Next.js Server Actions work seamlessly with NeuroLink.

**Vercel AI SDK (Before):**

```typescript
// app/actions.ts
'use server';

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function generateContent(prompt: string) {
  const { text } = await generateText({
    model: openai('gpt-4'),
    prompt,
  });

  return text;
}
```

**NeuroLink (After):**

```typescript
// app/actions.ts
'use server';

import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

export async function generateContent(prompt: string) {
  const result = await neurolink.generate({
    input: { text: prompt },
    provider: 'openai',
    model: 'gpt-4',
  });

  return result.content;
}

// Easy model switching for cost optimization
export async function generateContentCheap(prompt: string) {
  const result = await neurolink.generate({
    input: { text: prompt },
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307', // Cheaper model
  });

  return result.content;
}
```

## Streaming Patterns Deep Dive

### Text Streaming with Callbacks

NeuroLink provides clean streaming with async iteration:

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function streamWithProgress(prompt: string, onChunk: (chunk: string) => void) {
  let fullContent = '';

  const result = await neurolink.stream({
    input: { text: prompt },
    provider: 'openai',
    model: 'gpt-4',
  });

  for await (const chunk of result.stream) {
    fullContent += chunk.content;
    onChunk(chunk.content);
  }

  return fullContent;
}

// Usage
await streamWithProgress('Tell me a story', (chunk) => {
  process.stdout.write(chunk);
});
```

### Server-Sent Events (SSE)

```typescript
// app/api/stream/route.ts
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const result = await neurolink.stream({
        input: { text: prompt },
        provider: 'openai',
        model: 'gpt-4',
      });

      for await (const chunk of result.stream) {
        if (chunk.content) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`)
          );
        }
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### Client-Side SSE Consumption

```typescript
// components/StreamingChat.tsx
'use client';

import { useState } from 'react';

export function StreamingChat() {
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(prompt: string) {
    setIsLoading(true);
    setResponse('');

    const res = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          const data = JSON.parse(line.slice(6));
          setResponse((prev) => prev + data.content);
        }
      }
    }

    setIsLoading(false);
  }

  return (
    <div>
      <button onClick={() => handleSubmit('Tell me a joke')} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate'}
      </button>
      <div>{response}</div>
    </div>
  );
}
```

## Advanced Migration Patterns

### Provider Fallback Pattern

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

interface ProviderConfig {
  provider: string;
  model: string;
}

async function generateWithFallback(prompt: string) {
  const providers: ProviderConfig[] = [
    { provider: 'openai', model: 'gpt-4' },
    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    { provider: 'google', model: 'gemini-2.0-flash' },
  ];

  for (const { provider, model } of providers) {
    try {
      const result = await neurolink.generate({
        input: { text: prompt },
        provider,
        model,
      });

      return {
        content: result.content,
        provider,
        model,
      };
    } catch (error) {
      console.warn(`Provider ${provider}/${model} failed, trying next...`);
      continue;
    }
  }

  throw new Error('All providers failed');
}
```

### Parallel Generation Pattern

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function generateMultiple(prompt: string) {
  const providers = [
    { provider: 'openai', model: 'gpt-4' },
    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  ];

  const results = await Promise.allSettled(
    providers.map(({ provider, model }) =>
      neurolink.generate({
        input: { text: prompt },
        provider,
        model,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ content: string }> => r.status === 'fulfilled')
    .map((r, i) => ({
      provider: providers[i].provider,
      model: providers[i].model,
      result: r.value.content,
    }));
}
```

### Middleware Integration

Create custom middleware for request processing:

```typescript
// middleware/neurolink.ts
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function checkRateLimit(userId: string): Promise<boolean> {
  // Your rate limiting logic
  return true;
}

async function logUsage(userId: string, content: string): Promise<void> {
  // Your logging logic
  console.log(`User ${userId} generated ${content.length} chars`);
}

export async function generateWithMiddleware(userId: string, prompt: string) {
  // Check rate limits
  const allowed = await checkRateLimit(userId);
  if (!allowed) {
    throw new Error('Rate limit exceeded');
  }

  const result = await neurolink.generate({
    input: { text: prompt },
    provider: 'openai',
    model: 'gpt-4',
  });

  // Log usage
  await logUsage(userId, result.content);

  return result.content;
}
```

### Streaming with Abort Controller

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function streamWithAbort(prompt: string, signal: AbortSignal) {
  const streamResult = await neurolink.stream({
    input: { text: prompt },
    provider: 'openai',
    model: 'gpt-4',
  });

  let result = '';

  for await (const chunk of streamResult.stream) {
    if (signal.aborted) {
      console.log('Stream aborted');
      break;
    }
    result += chunk.content;
    process.stdout.write(chunk.content);
  }

  return result;
}

// Usage with timeout
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000); // 30 second timeout

await streamWithAbort('Write a long story', controller.signal);
```

## Testing Your Migration

### Unit Tests

```typescript
// __tests__/neurolink.test.ts
import { NeuroLink } from '@juspay/neurolink';
import { describe, it, expect } from 'vitest';

describe('NeuroLink Migration', () => {
  const neurolink = new NeuroLink();

  it('should generate text response', async () => {
    const result = await neurolink.generate({
      input: { text: 'Say hello' },
      provider: 'openai',
      model: 'gpt-4',
    });

    expect(result).toBeTruthy();
    expect(result.content).toBeTruthy();
    expect(typeof result.content).toBe('string');
  });

  it('should stream responses', async () => {
    const chunks: string[] = [];

    const result = await neurolink.stream({
      input: { text: 'Count to 5' },
      provider: 'openai',
      model: 'gpt-4',
    });

    for await (const chunk of result.stream) {
      chunks.push(chunk.content);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle provider switching', async () => {
    const providers = [
      { provider: 'openai', model: 'gpt-4' },
      { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    ];

    for (const { provider, model } of providers) {
      const result = await neurolink.generate({
        input: { text: 'Hello' },
        provider,
        model,
      });

      expect(result).toBeTruthy();
    }
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/api.test.ts
import { describe, it, expect } from 'vitest';

describe('API Route Integration', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

  it('should handle generate endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Say hello' }),
    });

    const data = await response.json();
    expect(data.result).toBeTruthy();
  });

  it('should handle streaming endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Count to 3' }),
    });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    const { value } = await reader!.read();
    expect(value).toBeTruthy();
  });
});
```

## Migration Checklist

Use this checklist to ensure a complete migration:

### Dependencies

- [ ] Install `@juspay/neurolink`
- [ ] Add `NEUROLINK_API_KEY` to environment

### Client Configuration

- [ ] Create centralized NeuroLink client
- [ ] Configure default settings
- [ ] Set up error handling

### API Endpoints

- [ ] Migrate `/api/chat` routes
- [ ] Migrate `/api/completion` routes
- [ ] Update streaming responses to use async iteration
- [ ] Test SSE implementation

### Server Actions

- [ ] Migrate `generateText` calls to `neurolink.generate()`
- [ ] Migrate `streamText` calls to `neurolink.stream()`
- [ ] Update function signatures

### Frontend Components

- [ ] Replace Vercel AI SDK fetch calls with new API structure
- [ ] Update streaming consumption logic
- [ ] Implement custom state management for chat

### Testing

- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Test streaming behavior
- [ ] Verify error handling

### Cleanup

- [ ] Remove Vercel AI SDK dependencies (`ai`, `@ai-sdk/*`)
- [ ] Remove unused provider SDKs
- [ ] Update documentation

## Common Migration Patterns

### Before and After Summary

| Vercel AI SDK | NeuroLink |
|---------------|-----------|
| `import { generateText } from 'ai'` | `import { NeuroLink } from '@juspay/neurolink'` |
| `generateText({ model: openai('gpt-4'), prompt })` | `neurolink.generate({ input: { text: prompt }, provider: 'openai', model: 'gpt-4' })` |
| `streamText({ model, prompt })` | `neurolink.stream({ input: { text: prompt }, provider, model })` |
| `result.textStream` | `stream` (async iterable) |
| `result.toAIStreamResponse()` | Custom `ReadableStream` response |

### Key Differences

1. **Package**: Use `@juspay/neurolink` instead of `ai` or `@ai-sdk/*`
2. **Input format**: Use `input: { text: prompt }` instead of `prompt` or `messages`
3. **Provider/Model**: Specify `provider` and `model` as separate fields
4. **Response**: Result is returned directly, not wrapped in an object
5. **Streaming**: Returns an async iterable, iterate with `for await`

## Conclusion

Migrating from Vercel AI SDK to NeuroLink opens up possibilities for your AI-powered applications. With unified access to 13 providers, intelligent routing, and production-ready features, NeuroLink provides the foundation for scalable, cost-effective AI applications.

The migration process is straightforward thanks to NeuroLink's clean API design. Start with a parallel installation, migrate one route at a time, and thoroughly test before removing the old implementation.

Key takeaways from this migration guide:

- NeuroLink uses `@juspay/neurolink` with a simple `generate()` and `stream()` API
- Streaming works consistently across all 13 supported providers via async iteration
- Provider and model are specified as separate parameters for flexibility
- Next.js integration remains seamless with both API routes and Server Actions
- Provider flexibility allows easy model switching without code changes

Ready to start your migration? Sign up for a free NeuroLink account and follow this guide to unlock the full potential of unified AI access.

## Additional Resources

- [NeuroLink Documentation](https://docs.neurolink.ink)
- [API Reference](https://docs.neurolink.ink/sdk/api-reference/)
- [Model Comparison Guide](https://docs.neurolink.ink/reference/provider-comparison/)
- [Streaming Best Practices](/posts/streaming-best-practices)
- [Cost Optimization Strategies](/posts/cost-optimization-strategies)
