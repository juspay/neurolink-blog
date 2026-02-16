---
layout: post
title: 'NeuroLink 2025: Year in Review and Future Directions'
date: '2026-01-05 10:00:00 +0530'
last_updated: 2026-01-15T00:00:00.000Z
author: neurolink
description: >-
  A transparent look at what NeuroLink has shipped in 2025 and our thinking
  about potential future directions.
categories:
  - Announcement
  - Roadmap
tags:
  - roadmap
  - year-2025
  - features
  - announcement
  - planning
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/neurolink-2025-roadmap/hero.png
  alt: 'NeuroLink 2025: Year in Review and Future Directions'
---

We are excited to share NeuroLink's year in review and our direction for 2026. This post covers what we shipped, what we learned, and where we are heading next -- with complete transparency about what exists today and what remains on the roadmap.

## What NeuroLink Is Today

NeuroLink is an enterprise AI SDK that provides a unified interface to multiple AI providers. Here's what actually exists in the current SDK (v8.32.0):

### Supported Providers (12 providers)

| Provider | Status | Notes |
|----------|--------|-------|
| OpenAI | Production | Full tool support |
| Anthropic | Production | Full tool support |
| Google AI Studio | Production | Gemini models, image generation |
| Google Vertex | Production | Gemini 3 preview, image generation |
| Azure OpenAI | Production | Full tool support |
| AWS Bedrock | Production | Claude, Titan, Nova models |
| AWS SageMaker | Production | Custom model deployment |
| Mistral AI | Production | Full tool support |
| Hugging Face | Production | Partial tool support |
| Ollama | Production | Local model execution |
| LiteLLM | Production | Routes to 100+ models |
| OpenRouter | Production | Access to 300+ models |

### Core Features That Actually Exist

**Generation and Streaming**

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Basic generation
const result = await neurolink.generate({
  input: { text: 'Explain quantum computing' },
  provider: 'vertex',
  model: 'gemini-2.5-flash',
});

// Streaming
const result = await neurolink.stream({
  input: { text: 'Write a story' },
  provider: 'openai',
});

for await (const chunk of result.stream) {
  if ('content' in chunk) {
    process.stdout.write(chunk.content);
  }
}
```

**Image Generation (Gemini Only)**

```typescript
// Image generation with Gemini models (shipped in v8.31.0)
const result = await neurolink.generate({
  input: { text: 'A futuristic cityscape' },
  provider: 'vertex',  // or 'google-ai'
  model: 'gemini-2.5-flash-image',  // or 'gemini-3-pro-image-preview'
});

// Save generated image
if (result.imageOutput?.base64) {
  const buffer = Buffer.from(result.imageOutput.base64, 'base64');
  fs.writeFileSync('cityscape.png', buffer);
}
```

> **Note:** Model names and IDs in code examples reflect versions available at time of writing. Model availability, naming conventions, and pricing change frequently. Always verify current model IDs with your provider's documentation before deploying to production.
{: .prompt-info }

**Redis Conversation Memory**

```typescript
// Simple conversation persistence with Redis
const neurolink = new NeuroLink({
  conversationMemory: {
    enabled: true,
    store: 'redis',
    ttl: 86400 // 24-hour expiration
  }
});
```

**Human-in-the-Loop (HITL)**

```typescript
const neurolink = new NeuroLink({
  hitl: {
    enabled: true,
    dangerousActions: ['writeFile', 'executeCode'],
    timeout: 30000
  }
});
```

**MCP Tool Integration**

```typescript
// Add external MCP servers
await neurolink.addExternalMCPServer('github', {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  transport: 'stdio',
  env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
});

// HTTP transport for remote servers
await neurolink.addExternalMCPServer('remote-tools', {
  transport: 'http',
  url: 'https://mcp.example.com/v1',
  headers: { Authorization: 'Bearer token' }
});
```

**6 Built-in Tools**

- `getCurrentTime` - Date and time access
- `readFile` - File system reading
- `writeFile` - File system writing
- `listDirectory` - Directory listing
- `calculateMath` - Mathematical operations
- `websearchGrounding` - Google Vertex web search

**Structured Output with Zod**

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email()
});

const result = await neurolink.generate({
  input: { text: 'Extract user info from: John is 30, email john@example.com' },
  schema: schema
});
```

**Multimodal Support**

- Image input and understanding
- CSV file processing
- PDF file processing
- File auto-detection

**Provider Failover**

```typescript
const { primary, fallback } = await createAIProviderWithFallback(
  'vertex',
  'bedrock'
);
```

## What We Shipped in 2025

Here are the major features that actually shipped this year:

- **Image Generation** (v8.31.0) - Native Gemini image generation
- **HTTP/Streamable MCP Transport** (v8.29.0) - Remote MCP server connections
- **Gemini 3 Preview Support** - Extended thinking with `gemini-3-flash-preview`
- **Structured Output with Zod** - Type-safe JSON generation
- **CSV and PDF File Support** - Multimodal document processing
- **LiteLLM and SageMaker Integration** - Expanded provider options
- **OpenRouter Integration** - Access to 300+ models
- **HITL System** - Human approval workflows
- **Redis Persistence** - Distributed conversation memory
- **Extended Thinking** - For Gemini 3 and Claude models
- **Workflow Engine** — `runWorkflow()` with 9 pre-built workflow strategies (adaptive, consensus, fallback, multi-judge) plus `registerWorkflow()` for custom workflows. Supports multi-step AI pipelines with evaluation gates.

## What Does NOT Exist (Correcting Previous Claims)

We want to be transparent about features that were previously discussed but do not exist in the SDK:

### Providers Not Directly Supported

- **Cohere** - Not a direct integration (may be accessible via LiteLLM)
- **Groq** - Not a direct integration (may be accessible via LiteLLM)
- **AI21 Labs** - Not a direct integration

If you need these providers, consider using LiteLLM which can route to them.

### Features That Don't Exist

**Multi-Agent Orchestration**: Multi-agent orchestration is not built-in as a first-class SDK feature, but can be composed using NeuroLink's provider abstraction and tool calling primitives. See our upcoming guide on multi-agent networks for implementation patterns.

**Memory Management**: Memory management via `sessionId`-based conversation tracking is built-in. Advanced semantic memory (Mem0 integration) exists internally and is planned for public API exposure in a future release.

**No Tool Ecosystem Features**: There is no:

- Community tool registry
- Tool versioning and deprecation system
- Tool composition primitives

**Embeddings API**: NeuroLink provides `embed()` on supported providers (OpenAI, Bedrock, Vertex). See our upcoming guide on embeddings and vector operations for usage details.

## Potential Future Directions

The following are areas we're exploring. These are not commitments - they represent directions we find interesting based on community feedback. Development priorities may change.

### Areas of Active Exploration

**Additional Provider Integrations**: We're evaluating adding direct support for Groq, Cohere, and other providers. Currently these are accessible via LiteLLM.

**Enhanced Memory Capabilities**: We're researching how to improve conversation context management beyond simple Redis storage. This is exploratory and we have no timeline.

**Improved Developer Experience**: We continue to focus on TypeScript types, error messages, and documentation. These improvements ship incrementally.

### Areas of Long-term Interest

**Agent Patterns**: While we don't plan a full multi-agent framework, we're interested in common agent patterns that could be documented or provided as utilities.

**Cost Optimization Tools**: Better visibility into token usage and cost across providers.

**Observability Improvements**: Enhanced integration with monitoring and logging systems.

## How to Provide Feedback

We want to build what developers actually need. If you have feature requests or feedback:

- **GitHub Issues**: Open issues for specific feature requests
- **GitHub Discussions**: For broader conversations about direction
- **Discord**: For real-time community discussion

When requesting features, it helps to describe:

1. The specific problem you're trying to solve
2. How you're currently working around it
3. What an ideal solution would look like

## Honest Assessment

NeuroLink is a solid SDK for unified AI provider access with good streaming, tool support, embeddings, RAG pipelines, and enterprise features like HITL and Redis persistence. It does not include a built-in multi-agent orchestration framework.

If you need:

- **Unified multi-provider access**: NeuroLink is a good fit
- **Streaming with tool calling**: NeuroLink handles this well
- **Enterprise HITL workflows**: NeuroLink has this built in
- **Multi-agent orchestration**: Look at LangGraph, AutoGen, or similar
- **RAG pipelines**: NeuroLink includes a built-in `RAGPipeline` -- see the [RAG Implementation guide](/posts/rag-implementation/)
- **Fine-tuning**: Use provider-specific tools

We believe in doing fewer things well rather than overpromising on features that don't exist.

## Thank You

We are grateful to every developer, contributor, and early adopter who has shaped NeuroLink into what it is today. Your feedback, bug reports, and feature requests drive our roadmap. We built this for you, and we cannot wait to see what you build with it next.

---

*Questions about the SDK? Check our documentation at [docs.neurolink.ink](https://docs.neurolink.ink) or open a GitHub issue. We're here to help with what the SDK actually does.*

*The NeuroLink Team*

---

**Related posts:**

- [The Rise of AI Engineering: Why Every Backend Developer Should Learn AI SDKs](/posts/rise-of-ai-engineering/)
- [Contributing to NeuroLink: A Complete Guide](/posts/community-contributions/)
- [Getting Started with NeuroLink: Your First AI App in 5 Minutes](/posts/getting-started-first-ai-app/)
