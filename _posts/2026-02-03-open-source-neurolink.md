---
layout: post
title: 'Open Source AI Infrastructure: Why We Open-Sourced NeuroLink'
date: '2026-02-03 10:00:00 +0530'
categories:
  - Thought Leadership
  - Open Source
tags:
  - open-source
  - neurolink
  - juspay
  - apache-2
  - community
  - ai-infrastructure
  - transparency
author: neurolink
description: >-
  Why Juspay open-sourced NeuroLink, their production AI SDK serving millions of
  requests. Strategy, lessons, and community vision.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/open-source-neurolink/hero.png
  alt: 'Open Source AI Infrastructure: Why We Open-Sourced NeuroLink'
---

We open-sourced NeuroLink because anyone who builds on AI infrastructure deserves a public good, not a proprietary moat. This is a deliberate strategic choice: when the abstraction layer is open, innovation happens faster, vendor lock-in disappears, and the entire ecosystem benefits. Here is why we made this decision and what it means for the future of AI development.

This was not an act of charity. It was a strategic decision driven by clear reasoning about where value lives in the AI stack, how community contributions compound, and why enterprises need transparent infrastructure for their most critical AI workloads. This post explains the why, the what, and the lessons learned.

## The Origin Story: Why NeuroLink Exists

### The Problem at Juspay

Juspay is one of India's largest payment platforms. As AI became critical for fraud detection, customer support automation, and document processing, teams across the company needed AI infrastructure. But each team was building their own provider integration -- duplicating effort, introducing inconsistent patterns, and creating independent failure modes.

When a provider outage hit, it caused customer-facing incidents. One team used Bedrock, another used Vertex, a third called OpenAI directly. There was no unified error handling, no failover, no shared observability. Every team learned the same lessons independently, often the hard way.

The need was clear: a unified AI layer with production reliability that all teams could share.

### What We Built

NeuroLink started as a thin wrapper around AI provider APIs. Over time, it grew into a comprehensive SDK:

- **Unified interface** across providers -- started with Bedrock and Vertex, grew to 13 providers
- **Automatic failover** and circuit breakers for production resilience
- **MCP-based tool integration** with 58+ tools across 4 transport protocols
- **Streaming normalization** so every provider's stream works the same way
- **HITL workflows** for regulatory compliance in fintech
- **Redis-backed conversation memory** for stateful interactions
- **RAG pipeline** with 10 chunking strategies and hybrid search
- **Middleware system** for analytics, guardrails, and custom processing

### The Scale

The codebase behind NeuroLink represents real production battle-testing:

- 831 commits and 412 TypeScript files
- 13 AI provider integrations
- 58+ MCP tools
- Proven in fintech production at Juspay's scale

This is not a weekend prototype. It is infrastructure that handles real traffic for real users in one of the most regulated industries.

## Why Open Source?

### Reason 1: AI Infrastructure Should Be a Public Good

AI providers are proprietary by necessity -- training large models costs hundreds of millions of dollars. But the orchestration layer -- how you call, manage, fail over, and compose AI providers -- has no reason to be proprietary. The orchestration patterns are well-understood engineering problems: API normalization, retry logic, circuit breakers, streaming, caching.

Open-sourcing NeuroLink contributes to a healthier AI ecosystem where developers focus on building applications rather than re-implementing the same plumbing layer. Every company building AI features today is solving the same infrastructure problems. Why should each of them solve them independently?

### Reason 2: Community Improves the Code Faster Than Any Single Team

Provider APIs change frequently. When OpenAI updates their streaming format, or Anthropic changes their tool calling schema, or Google introduces a new model tier, someone needs to update the SDK. With a community of developers using different providers in different production environments, issues are caught faster and fixes ship sooner.

Edge cases from diverse production environments improve reliability in ways no internal team can match. A fintech company discovers a race condition under high concurrency. An AgTech startup finds a timeout issue on slow rural connections. A healthcare platform identifies a streaming normalization bug with long outputs. Each of these contributions makes NeuroLink better for everyone.

New provider integrations come from developers who actually use those providers. The OpenRouter integration, adding support for 300+ models, came from a community contributor who needed it for their own product. That is how open source compounds.

### Reason 3: Trust Through Transparency

Enterprises evaluating AI SDKs need to audit the code. When you pass customer data through a third-party SDK, you need to know what it does with that data. Does it log prompts? Does it phone home? Does it share data with the SDK vendor?

With NeuroLink, the answer is in the source code. Security-sensitive industries -- fintech, healthcare, government -- require full source access. Open source eliminates the "what does this SDK actually do with my data?" question entirely.

Apache 2.0 licensing provides the legal clarity enterprises need: commercial use, modification, and distribution are all explicitly permitted, with an explicit patent grant that MIT lacks.

### Reason 4: Ecosystem Compounding

Open standards (MCP) plus open source (NeuroLink) equals maximum interoperability. Tools built on NeuroLink work with other MCP-compatible clients. Blog posts, tutorials, and community content amplify adoption. The SDK improves faster when adoption is wider.

This is the flywheel: more users create more feedback, which produces better code, which attracts more users. Open source is the only distribution model that creates this compounding effect.

## What We Open-Sourced

The complete feature set. No "community edition" versus "enterprise edition." Everything is in the open repository.

| Module | Description | Source Path |
|---|---|---|
| **Core SDK** | NeuroLink class, generate(), stream() | `src/lib/neurolink.ts` |
| **13 Providers** | OpenAI, Anthropic, Vertex, Bedrock, Azure, Google AI, Mistral, Ollama, LiteLLM, HuggingFace, SageMaker, OpenRouter, OpenAI-Compatible | `src/lib/providers/` |
| **MCP Ecosystem** | Tool registry, server manager, 4 transports, OAuth | `src/lib/mcp/` |
| **RAG Pipeline** | 10 chunkers, hybrid search, Graph RAG, reranking | `src/lib/rag/` |
| **Workflow Engine** | Ensemble, chain, adaptive, judge scoring | `src/lib/workflow/` |
| **Server Adapters** | Hono, Express, Fastify, Koa | `src/lib/server/adapters/` |
| **Middleware** | Analytics, guardrails, custom pipelines | `src/lib/middleware/` |
| **HITL** | Human-in-the-loop approval workflows | `src/lib/hitl/` |
| **Memory** | Redis, Mem0, conversation management | `src/lib/memory/`, `src/lib/core/` |
| **Observability** | OpenTelemetry, Langfuse integration | `src/lib/services/server/ai/observability/` |
| **CLI** | 15+ commands for setup, management, serving | `src/cli/` |
| **Types** | Full TypeScript type system | `src/lib/types/` |

Every feature that runs in production at Juspay is available in the open-source release. We believe this is the only credible approach. An open-source project with artificial feature gates is not really open source -- it is a free trial.

## The Apache 2.0 Decision

We evaluated four license options before settling on Apache 2.0:

| License | Permissive? | Patent Grant? | Copyleft? | Enterprise-Friendly? |
|---|---|---|---|---|
| MIT | Yes | No | No | Yes |
| Apache 2.0 | Yes | **Yes** | No | **Yes** |
| GPL v3 | No | Yes | **Yes** | No |
| BSL | Varies | No | Varies | No |

Apache 2.0 won because:

- **Permissive**: Companies can use NeuroLink in commercial products without licensing concerns
- **Patent protection**: Apache 2.0 includes an explicit patent grant that MIT does not. This matters for enterprise legal teams.
- **Enterprise-friendly**: Legal teams at large companies are pre-approved for Apache 2.0. Kubernetes, TensorFlow, and many major open-source projects use it.
- **No copyleft**: Companies can modify NeuroLink without being required to open-source their changes. This removes adoption friction for proprietary applications.

## What We Learned from Open-Sourcing

For other teams considering open-sourcing internal tools, here are our lessons:

### Documentation Quality Had to Increase 10x

Internal teams have tribal knowledge. They know which configuration options are important, which are legacy, and which are dangerous. External users have none of this context. Every API, every configuration option, every error message needed documentation that a first-time user could understand.

We underestimated this effort by an order of magnitude. Documentation is not a follow-up task -- it is a prerequisite for open-sourcing.

### API Surface Design Became Critical

Breaking changes in internal tools are annoying. Breaking changes in open source are costly. Users build on your API, and changing it means they have to change their code. We spent weeks refining the public API surface before the open-source launch, collapsing internal-only interfaces and ensuring the remaining API would be stable for years.

### Testing Coverage Mattered More

External users find edge cases internal teams never hit. Different Node.js versions, different operating systems, different network configurations, different provider account setups. Our test coverage had to expand from "covers our use cases" to "covers reasonable use cases from anyone."

### Community Management Is a Skill

Responding to issues, reviewing PRs, and maintaining a welcoming environment requires dedicated effort. It is a distinct skill set from writing code. We invested in contributor guidelines, issue templates, and a code of conduct early.

### Open Source Is Marketing

Developers who use NeuroLink become advocates. They write blog posts, answer questions, and recommend it to colleagues. This organic reach is more effective than any paid marketing campaign, and it targets exactly the right audience: developers who build AI applications.

### Feedback Loop Accelerated

Bug reports from diverse environments improved reliability faster than any internal QA process. In the first month after open-sourcing, we received more edge-case bug reports than in the previous six months of internal use.

### Internal Culture Shifted

Open-sourcing changed how our own engineers wrote code. When you know the public will read your implementation, you write cleaner abstractions, better comments, and more thoughtful error messages. The quality bar for internal PRs rose noticeably after the project went public -- not because we mandated it, but because engineers took pride in the public codebase.

### Prioritization Became Community-Driven

Before open source, our roadmap was driven entirely by internal needs. Afterward, GitHub issues and discussions surfaced use cases we had never considered. A logistics company needed batch processing across providers with different rate limits. An education startup needed conversation memory that worked across browser sessions. These requests reshaped our priorities in ways that made the SDK genuinely more versatile.

## How to Contribute

We have designed clear paths for community participation at every skill level:

- **Bug reports**: File GitHub issues with reproduction steps. Even a bug report without a fix is valuable.
- **Provider integrations**: Add new AI providers following the `BaseProvider` pattern in `src/lib/providers/`. The pattern is well-documented and consistent across all 13 existing providers.
- **MCP servers**: Build new MCP tool servers for the ecosystem using the factory pattern in `src/lib/mcp/factory.ts`.
- **Documentation**: Improve guides, add examples, fix typos. Low-barrier, high-impact contributions.
- **Testing**: Integration tests across providers. Particularly valuable because they require access to different provider accounts.
- **Blog posts**: Share your NeuroLink projects and patterns. We feature community content on the blog.

The source code is structured to make contributions straightforward. Each provider follows the same base class pattern. Each middleware follows the same interface. New contributors can look at any existing implementation as a template.

### Example: Implementing a New Provider Adapter

To illustrate how approachable the contribution process is, here is a simplified example of what a new provider adapter looks like. Every provider extends `BaseProvider` and implements a consistent interface:

```typescript
import { BaseProvider } from '../base-provider';
import type {
  ProviderConfig,
  GenerateOptions,
  GenerateResponse,
  StreamChunk,
} from '../../types';

export class ExampleAIProvider extends BaseProvider {
  readonly name = 'example-ai';
  readonly supportedModels = ['example-large', 'example-fast'];

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig(['apiKey']); // Ensures required fields are present
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const response = await this.httpClient.post(
      'https://api.example-ai.com/v1/chat/completions',
      {
        model: options.model,
        messages: this.formatMessages(options.messages),
        temperature: options.temperature ?? 0.7,
      },
      { headers: { Authorization: `Bearer ${this.config.apiKey}` } }
    );

    return this.normalizeResponse(response.data);
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const stream = await this.httpClient.stream(
      'https://api.example-ai.com/v1/chat/completions',
      {
        model: options.model,
        messages: this.formatMessages(options.messages),
        stream: true,
      },
      { headers: { Authorization: `Bearer ${this.config.apiKey}` } }
    );

    for await (const chunk of stream) {
      yield this.normalizeStreamChunk(chunk);
    }
  }
}
```

The `BaseProvider` class handles retry logic, circuit breakers, error normalization, and telemetry. A contributor adding a new provider only needs to implement the provider-specific HTTP calls and response mapping. The existing 13 providers in `src/lib/providers/` each serve as a working reference implementation.

## Community Governance

Open-sourcing code is the easy part. Building a sustainable community requires governance structures that balance speed with inclusivity.

We follow an RFC (Request for Comments) process for significant changes. Any community member can propose an RFC by opening a GitHub discussion. RFCs remain open for a minimum of two weeks to allow asynchronous participation across time zones. Proposals that affect the public API surface, add new providers, or change default behaviors always go through this process.

Maintainer responsibilities are explicit. Core maintainers commit to triaging new issues within 48 hours, reviewing PRs within one week, and participating in monthly community calls. We promote active contributors to maintainer status based on sustained, quality contributions rather than volume alone. Currently, three of our seven maintainers came from the external community.

Decision-making follows a "lazy consensus" model borrowed from Apache Software Foundation governance. Proposals pass unless a maintainer raises a reasoned objection. For contentious decisions, we hold a formal vote among maintainers with a simple majority threshold. This keeps the project moving without bottlenecking on any single person.

## Conclusion

The direction is clear, even if the timeline is not. Organizations that invest in these capabilities now -- building the infrastructure, developing the talent, establishing the practices -- will compound their advantage over those that wait. The question is not whether this shift will happen, but whether your team will be leading it or catching up. The tools are available. The patterns are proven. The only remaining variable is execution.

---

**Related posts:**

- [Vector Database Guide: Pinecone vs Qdrant vs pgvector with NeuroLink](/posts/vector-database-guide/)
- [Contributing to NeuroLink: A Complete Guide](/posts/community-contributions/)
- [Getting Started with NeuroLink: Your First AI App in 5 Minutes](/posts/getting-started-first-ai-app/)
