---
layout: post
title: 'Migrating from LangChain to NeuroLink: A Step-by-Step Guide'
date: '2025-07-22 10:00:00 +0530'
last_updated: 2026-07-04T00:00:00.000Z
categories:
  - Migration
  - Tutorial
tags:
  - langchain
  - migration
  - comparison
  - typescript
  - patterns
author: neurolink
description: >-
  Migrate from LangChain to NeuroLink. Code mappings, pattern translations, and
  migration strategies.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/langchain-migration-guide/hero.png
  alt: 'Migrating from LangChain to NeuroLink: A Step-by-Step Guide'
---

By the end of this guide, you'll have migrated your LangChain application to NeuroLink with side-by-side code comparisons, pattern translations, and a step-by-step migration strategy.

**Verification Details:** This guide was verified with NeuroLink v9.79.2 released June 2026.

> Tested: 2026-07-04 against NeuroLink v9.79.2

## Why Teams Are Migrating

Before diving into the technical details, let's understand why organizations are making the switch. LangChain pioneered many concepts in the LLM application space, but as projects mature, teams often encounter challenges that NeuroLink addresses directly.

### Common Pain Points with LangChain

**Complex Abstractions**: LangChain's extensive abstraction layers (Chains, Runnables, OutputParsers) add cognitive overhead. NeuroLink provides a single, intuitive API that handles all use cases.

**Provider Lock-in**: Switching between OpenAI, Anthropic, or other providers in LangChain requires different package imports and class instantiation per provider. NeuroLink lets you swap providers with a single parameter change.

**Bundle Size Concerns**: LangChain's comprehensive nature often means pulling in more than you need. NeuroLink's focused design keeps your bundle lean.

**Debugging Complexity**: LangChain's abstraction layers can make it difficult to understand what's happening when things go wrong. NeuroLink's transparent execution model provides clear visibility into every request.

> **Note on alternatives:** If your primary goal is TypeScript-native agent orchestration with durable workflows and multi-agent patterns (rather than provider unification), [Mastra](https://github.com/mastra-ai/mastra) (v1.48.0, Apache 2.0 core) is worth evaluating alongside NeuroLink. Mastra provides a graph-based workflow engine with suspend/resume and a 4-layer memory system, at the cost of a larger surface area. This guide focuses on the NeuroLink migration path.

## Understanding the Conceptual Mappings

The first step in migration is understanding how LangChain concepts map to NeuroLink equivalents. NeuroLink intentionally simplifies the mental model.

### Core Concept Mappings

| LangChain Concept | NeuroLink Equivalent | Notes |
|-------------------|---------------------|-------|
| LLM/ChatModel | `neurolink.generate()` | Single unified method |
| PromptTemplate | `input.text` + `systemPrompt` option | Built-in to the generate call |
| Chain | Sequential `generate()` calls | No special abstraction needed |
| Streaming | `neurolink.stream()` | Native async iterator support |
| Multiple Providers | `provider` parameter | Switch providers instantly |
| Message History | `conversationHistory` | Pass conversation history directly |

## Side-by-Side Code Comparisons

Let's examine how common patterns translate from LangChain to NeuroLink. Each example shows the LangChain approach followed by the NeuroLink equivalent.

### Basic LLM Invocation

**LangChain:**

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4",
  temperature: 0.7,
});

const response = await model.invoke("What is the capital of France?");
console.log(response.content);
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Model strings in this guide are illustrative. Current OpenAI flagship (mid-2026): gpt-5.4 / gpt-5.5.
const response = await neurolink.generate({
  input: { text: "What is the capital of France?" },
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
});

console.log(response.content);
```

The NeuroLink version uses a unified API where provider selection is explicit and switching providers is trivial.

### System Prompts

**LangChain:**

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({ model: "gpt-4" });

const response = await model.invoke([
  new SystemMessage("You are a helpful assistant that speaks like a pirate."),
  new HumanMessage("What is AI?"),
]);

console.log(response.content);
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const response = await neurolink.generate({
  input: { text: "What is AI?" },
  systemPrompt: "You are a helpful assistant that speaks like a pirate.",
  provider: 'openai',
  model: 'gpt-4',
});

console.log(response.content);
```

NeuroLink's `systemPrompt` parameter eliminates the need for message class imports and instantiation.

### Chat Conversations

**LangChain:**

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({ model: "gpt-4" });

const messages = [
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("Hello!"),
  new AIMessage("Hi there! How can I help you today?"),
  new HumanMessage("Tell me about TypeScript."),
];

const response = await model.invoke(messages);
console.log(response.content);
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const response = await neurolink.generate({
  input: { text: "Tell me about TypeScript." },
  conversationHistory: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there! How can I help you today?' },
  ],
  provider: 'openai',
  model: 'gpt-4',
});

console.log(response.content);
```

NeuroLink uses plain objects for messages, making them easier to serialize, store, and manipulate.

### Streaming Responses

**LangChain:**

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4",
  streaming: true,
});

const stream = await model.stream("Tell me a story about a robot.");

for await (const chunk of stream) {
  process.stdout.write(chunk.content as string);
}
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const result = await neurolink.stream({
  input: { text: "Tell me a story about a robot." },
  provider: 'openai',
  model: 'gpt-4',
});

for await (const chunk of result.stream) {
  if ('content' in chunk) {
    process.stdout.write(chunk.content);
  }
}
```

Both frameworks support async iterators, but NeuroLink's streaming is built into the core API rather than being a configuration option.

### Switching Providers

**LangChain:**

```typescript
// OpenAI
import { ChatOpenAI } from "@langchain/openai";
const openaiModel = new ChatOpenAI({ model: "gpt-4" });

// Anthropic - requires different import and class
import { ChatAnthropic } from "@langchain/anthropic";
const anthropicModel = new ChatAnthropic({ model: "claude-3-5-sonnet-20241022" });

// Different packages, different APIs
const response1 = await openaiModel.invoke("Hello");
const response2 = await anthropicModel.invoke("Hello");
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// OpenAI
const openaiResponse = await neurolink.generate({
  input: { text: "Hello" },
  provider: 'openai',
  model: 'gpt-4',
});

// Anthropic - just change two parameters
const anthropicResponse = await neurolink.generate({
  input: { text: "Hello" },
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
});

// Same API, same response structure
console.log(openaiResponse.content);
console.log(anthropicResponse.content);
```

This is NeuroLink's killer feature: true provider abstraction with zero code changes beyond the `provider` and `model` parameters.

### Sequential Processing (Chains)

**LangChain:**

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({ model: "gpt-4" });

const summarizePrompt = PromptTemplate.fromTemplate(
  "Summarize this text in one sentence: {text}"
);

const translatePrompt = PromptTemplate.fromTemplate(
  "Translate this to French: {summary}"
);

const chain = RunnableSequence.from([
  summarizePrompt,
  model,
  new StringOutputParser(),
  (summary) => ({ summary }),
  translatePrompt,
  model,
  new StringOutputParser(),
]);

const result = await chain.invoke({
  text: "Long article about technology..."
});
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Step 1: Summarize
const summaryResponse = await neurolink.generate({
  input: { text: "Long article about technology..." },
  systemPrompt: "Summarize this text in one sentence.",
  provider: 'openai',
  model: 'gpt-4',
});

// Step 2: Translate
const translationResponse = await neurolink.generate({
  input: { text: summaryResponse.content },
  systemPrompt: "Translate this to French.",
  provider: 'openai',
  model: 'gpt-4',
});

console.log(translationResponse.content);
```

NeuroLink doesn't need special chain abstractions. Standard JavaScript async/await provides clear, debuggable sequential processing.

### Parallel Processing

**LangChain:**

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { RunnableParallel } from "@langchain/core/runnables";

const model = new ChatOpenAI({ model: "gpt-4" });

const parallel = RunnableParallel.from({
  summary: summaryChain,
  keywords: keywordChain,
  sentiment: sentimentChain,
});

const results = await parallel.invoke({ text: "..." });
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const text = "Your text to analyze...";

// Use Promise.all for parallel execution
const [summary, keywords, sentiment] = await Promise.all([
  neurolink.generate({
    input: { text },
    systemPrompt: "Summarize this text concisely.",
    provider: 'openai',
    model: 'gpt-4',
  }),
  neurolink.generate({
    input: { text },
    systemPrompt: "Extract 5 keywords from this text.",
    provider: 'openai',
    model: 'gpt-4',
  }),
  neurolink.generate({
    input: { text },
    systemPrompt: "Analyze the sentiment of this text.",
    provider: 'openai',
    model: 'gpt-4',
  }),
]);

console.log({
  summary: summary.content,
  keywords: keywords.content,
  sentiment: sentiment.content,
});
```

Native JavaScript `Promise.all` handles parallel execution cleanly without special framework constructs.

### Building a Chatbot with Memory

**LangChain:**

```typescript
import { ChatOpenAI } from "@langchain/openai";
// Note: BufferMemory and ConversationChain were deprecated in LangChain 0.x
// and moved to @langchain/classic in LangChain 1.0 (released Oct 2025).
// LangChain 1.x recommends using createAgent() for stateful conversations.
// See: https://www.langchain.com/blog/langchain-langgraph-1dot0
import { BufferMemory } from "@langchain/classic/memory";  // Legacy
import { ConversationChain } from "@langchain/classic/chains";  // Legacy

const model = new ChatOpenAI({ model: "gpt-4" });
const memory = new BufferMemory();

const chain = new ConversationChain({
  llm: model,
  memory,
});

await chain.invoke({ input: "My name is Alice" });
const response = await chain.invoke({ input: "What's my name?" });
console.log(response);
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Simple in-memory conversation history
const conversationHistory: Array<{ role: string; content: string }> = [
  { role: 'system', content: 'You are a helpful assistant.' },
];

async function chat(userMessage: string): Promise<string> {
  // Add user message to history
  conversationHistory.push({ role: 'user', content: userMessage });

  // Generate response
  const response = await neurolink.generate({
    input: { text: userMessage },
    conversationHistory,
    provider: 'openai',
    model: 'gpt-4',
  });

  // Add assistant response to history
  conversationHistory.push({ role: 'assistant', content: response.content });

  return response.content;
}

// Usage
await chat("My name is Alice");
const response = await chat("What's my name?");
console.log(response); // "Your name is Alice!"
```

NeuroLink doesn't prescribe a memory system. You manage conversation history with standard JavaScript arrays, giving you full control over storage, trimming, and persistence.

### Error Handling

**LangChain:**

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({ model: "gpt-4" });

try {
  const response = await model.invoke("Hello");
} catch (error) {
  // Error types vary by provider
  console.error(error.message);
}
```

**NeuroLink:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

try {
  const response = await neurolink.generate({
    input: { text: "Hello" },
    provider: 'openai',
    model: 'gpt-4',
  });
  console.log(response.content);
} catch (error) {
  // Consistent error structure across all providers
  if (error instanceof Error) {
    console.error('Generation failed:', error.message);
  }
}
```

## Building Reusable Utilities

Here's how to create helper functions that make your NeuroLink code even more concise:

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Reusable generation function with defaults
async function generate(
  prompt: string,
  options: {
    system?: string;
    provider?: string;
    model?: string;
    temperature?: number;
  } = {}
): Promise<string> {
  const response = await neurolink.generate({
    input: { text: prompt },
    systemPrompt: options.system,
    provider: options.provider || 'openai',
    model: options.model || 'gpt-4',
    temperature: options.temperature,
  });
  return response.content;
}

// Usage is now super clean
const summary = await generate("Summarize: ...", {
  system: "You are a concise summarizer.",
});

const translation = await generate("Hello world", {
  system: "Translate to Spanish.",
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
});
```

## Provider Failover Pattern

One powerful pattern enabled by NeuroLink's unified API is automatic provider failover:

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

interface ProviderConfig {
  provider: string;
  model: string;
}

const providers: ProviderConfig[] = [
  { provider: 'openai', model: 'gpt-4' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  { provider: 'google-ai', model: 'gemini-2.5-flash' },
];

async function generateWithFailover(prompt: string): Promise<string> {
  for (const config of providers) {
    try {
      const response = await neurolink.generate({
        input: { text: prompt },
        provider: config.provider,
        model: config.model,
      });
      return response.content;
    } catch (error) {
      console.warn(`${config.provider} failed, trying next...`);
      continue;
    }
  }
  throw new Error('All providers failed');
}
```

This pattern is cumbersome with LangChain due to different class imports and APIs per provider.

## Gradual Migration Strategy

You don't have to migrate everything at once. Here's a phased approach that minimizes risk.

### Phase 1: New Features in NeuroLink

Start by building new features with NeuroLink while leaving existing LangChain code untouched:

```typescript
// Existing LangChain code continues to work
import { existingChain } from "./legacy/langchain-chains";

// New features use NeuroLink
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Both can coexist in your application
app.post("/legacy", async (req, res) => {
  const result = await existingChain.invoke(req.body);
  res.json(result);
});

app.post("/new", async (req, res) => {
  const result = await neurolink.generate({
    input: { text: req.body.prompt },
    provider: 'openai',
    model: 'gpt-4',
  });
  res.json({ content: result.content });
});
```

### Phase 2: Create a Unified Interface

Create a wrapper that works with both frameworks during transition:

```typescript
// ai-service.ts
import { NeuroLink } from '@juspay/neurolink';
import { ChatOpenAI } from "@langchain/openai";

const neurolink = new NeuroLink();
const langchainModel = new ChatOpenAI({ model: "gpt-4" });

// Feature flag to control migration
const USE_NEUROLINK = process.env.USE_NEUROLINK === 'true';

export async function generateText(prompt: string): Promise<string> {
  if (USE_NEUROLINK) {
    const response = await neurolink.generate({
      input: { text: prompt },
      provider: 'openai',
      model: 'gpt-4',
    });
    return response.content;
  } else {
    const response = await langchainModel.invoke(prompt);
    return response.content as string;
  }
}
```

### Phase 3: Component-by-Component Migration

Migrate one component at a time, starting with the simplest and working toward complex patterns.

**Migration Order Recommendation:**

1. Simple completion calls
2. Streaming responses
3. System prompts
4. Conversation handling
5. Sequential processing (chains)
6. Parallel processing
7. Error handling and retries
8. Complex multi-step workflows

### Phase 4: Testing and Validation

For each migrated component, ensure behavioral equivalence:

```typescript
import { describe, it, expect } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import { NeuroLink } from '@juspay/neurolink';

describe("Migration Validation", () => {
  const langchainModel = new ChatOpenAI({ model: "gpt-4" });
  const neurolink = new NeuroLink();

  const testPrompts = [
    "What is 2+2?",
    "Capital of France?",
    "Explain TypeScript in one sentence.",
  ];

  for (const prompt of testPrompts) {
    it(`should handle: ${prompt}`, async () => {
      const langchainResult = await langchainModel.invoke(prompt);
      const neurolinkResult = await neurolink.generate({
        input: { text: prompt },
        provider: 'openai',
        model: 'gpt-4',
      });

      // Both should return meaningful content
      expect(langchainResult.content).toBeTruthy();
      expect(neurolinkResult.content).toBeTruthy();
    });
  }
});
```

### Phase 5: Cleanup

Once all components are migrated and validated, remove LangChain dependencies:

```bash
npm uninstall langchain @langchain/core @langchain/openai @langchain/anthropic @langchain/classic

# Verify no imports remain
grep -r "@langchain" src/
grep -r "from \"langchain" src/
```

## Common Migration Pitfalls

### Pitfall 1: Message Format Differences

LangChain uses class instances; NeuroLink uses plain objects:

```typescript
// LangChain - class instances
import { HumanMessage } from "@langchain/core/messages";
const message = new HumanMessage("Hello");

// NeuroLink - plain objects
const message = { role: 'user', content: 'Hello' };
```

### Pitfall 2: Response Structure

Responses are structured differently:

```typescript
// LangChain
const response = await model.invoke("Hello");
const text = response.content; // Can be string or array

// NeuroLink
const response = await neurolink.generate({
  input: { text: "Hello" },
  provider: 'openai',
  model: 'gpt-4',
});
const text = response.content; // Always string
```

### Pitfall 3: Configuration Location

Configuration moves from constructor to method call:

```typescript
// LangChain - configuration in constructor
const model = new ChatOpenAI({
  model: "gpt-4",
  temperature: 0.7,
  maxTokens: 1000,
});

// NeuroLink - configuration in generate call
const response = await neurolink.generate({
  input: { text: "Hello" },
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
});
```

## Benefits After Migration

After migration, you'll notice improvements in several areas:

### Code Simplicity

- No more importing different classes for different providers
- No special abstractions for chains, memory, or output parsing
- Standard JavaScript patterns (Promise.all, async/await) work naturally

### Provider Flexibility

- Switch providers with a parameter change
- Build failover patterns easily
- Test with different providers without code changes

### Bundle Size

LangChain applications typically include significantly larger framework bundles
compared to NeuroLink's focused SDK approach.

> **Note:** Actual bundle sizes vary by features used. Benchmark your specific use case.

### Debugging

- Clear request/response flow
- No hidden abstraction layers
- Standard error handling patterns

## Migration Checklist

Use this checklist to track your migration progress:

- [ ] Install NeuroLink: `npm install @juspay/neurolink`
- [ ] Create NeuroLink instance in your app
- [ ] Migrate simple completion calls
- [ ] Migrate streaming implementations
- [ ] Migrate system prompts
- [ ] Migrate conversation/chat patterns
- [ ] Replace chains with sequential generate calls
- [ ] Replace parallel runnables with Promise.all
- [ ] Update error handling
- [ ] Create helper utilities for common patterns
- [ ] Add provider failover if needed
- [ ] Test thoroughly
- [ ] Remove LangChain dependencies
- [ ] Update documentation

## Complete Migration Example

Here's a before/after comparison of a complete chatbot:

**LangChain Version:**

```typescript
import { ChatOpenAI } from "@langchain/openai";
// Note: BufferMemory and ConversationChain were deprecated in LangChain 0.x
// and moved to @langchain/classic in LangChain 1.0 (Oct 2025).
// LangChain 1.x recommends using createAgent() for stateful conversations.
// See: https://www.langchain.com/blog/langchain-langgraph-1dot0
import { BufferMemory } from "@langchain/classic/memory";  // Legacy
import { ConversationChain } from "@langchain/classic/chains";  // Legacy
import {
  SystemMessage,
  HumanMessage,
  AIMessage
} from "@langchain/core/messages";

const model = new ChatOpenAI({
  model: "gpt-4",
  streaming: true,
});

const memory = new BufferMemory();

const chain = new ConversationChain({
  llm: model,
  memory,
});

async function chat(userInput: string): Promise<void> {
  const stream = await chain.stream({ input: userInput });
  for await (const chunk of stream) {
    process.stdout.write(chunk.response || '');
  }
  console.log();
}
```

**NeuroLink Version:**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const history: Array<{ role: string; content: string }> = [
  { role: 'system', content: 'You are a helpful assistant.' },
];

async function chat(userInput: string): Promise<void> {
  history.push({ role: 'user', content: userInput });

  const result = await neurolink.stream({
    input: { text: userInput },
    conversationHistory: history,
    provider: 'openai',
    model: 'gpt-4',
  });

  let fullResponse = '';
  for await (const chunk of result.stream) {
    if ('content' in chunk) {
      process.stdout.write(chunk.content);
      fullResponse += chunk.content;
    }
  }
  console.log();

  history.push({ role: 'assistant', content: fullResponse });
}
```

The NeuroLink version is more explicit, easier to understand, and gives you full control over the conversation history.

## Conclusion

By now you have a working migration path for every major LangChain pattern: providers, chains, memory, streaming, and tools. The key steps are:

1. Install NeuroLink alongside LangChain
2. Migrate one route or feature at a time using `generate()` and `stream()`
3. Replace chain patterns with direct NeuroLink calls or direct API calls
4. Manage conversation history as plain JavaScript arrays passed via `conversationHistory`
5. Remove LangChain once all routes are validated

The result is a simpler codebase with fewer abstractions, standard JavaScript patterns, and the ability to switch providers with a single parameter change.

For the full API reference and additional migration examples, see the [NeuroLink documentation](https://github.com/juspay/neurolink).

---

**Related posts:**

- [What is NeuroLink? The Unified AI SDK Explained](/posts/what-is-neurolink-unified-sdk/)
- [Getting Started with NeuroLink: Your First AI App in 5 Minutes](/posts/getting-started-first-ai-app/)
- [Multi-Provider Failover: Never Lose an API Call](/posts/provider-failover-patterns/)
