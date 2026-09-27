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
  Why Juspay open-sourced NeuroLink, and how an open provider-abstraction layer
  improves transparency, portability, and community collaboration.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/open-source-neurolink/hero.png
  alt: 'Open Source AI Infrastructure: Why We Open-Sourced NeuroLink'
---

We open-sourced NeuroLink because anyone who builds on AI infrastructure deserves a public good, not a proprietary moat.

This is a deliberate strategic choice: when the abstraction layer is open, innovation happens faster, vendor lock-in disappears, and the entire ecosystem benefits. Here is why we made this decision and what it means for the future of AI development.

This was not an act of charity. It was a strategic decision driven by clear reasoning about where value lives in the AI stack, how community contributions compound, and why enterprises need transparent infrastructure for their most critical AI workloads. This post explains the why, the what, and the lessons learned.

## The Origin Story: Why NeuroLink Exists

### The Problem at Juspay

Juspay built NeuroLink to give teams a common abstraction over AI providers. Without a shared layer, teams can duplicate provider integrations, error handling, streaming normalization, and observability while creating separate failure modes.

A unified layer makes those concerns reusable across applications while allowing each request to select an appropriate provider and model.

### What We Built

NeuroLink started as a thin wrapper around AI provider APIs. Over time, it grew into a comprehensive SDK:

- **Unified interface** across native and catalog-backed LLM providers
- **Retries and configurable provider fallback** for production resilience
- **MCP integration** with stdio, SSE, WebSocket, and HTTP transports
- **Streaming normalization** across providers
- **HITL workflows** for approval-sensitive tool calls
- **In-memory or Redis-backed conversation memory** for stateful interactions
- **RAG pipeline** with 10 chunking strategies and pluggable vector stores
- **Middleware system** for analytics, guardrails, and custom processing

### The Scale

The open-source codebase includes:

- 33 named LLM providers across native integrations and a JSON catalog, plus a generic OpenAI-compatible adapter
- MCP connectivity to arbitrary servers, with nine one-command configurations
- RAG adapters for in-memory storage, Pinecone, pgvector, and Chroma
- Workflow, evaluation, observability, HITL, and conversation-memory modules

NeuroLink was built at Juspay and is used by Juspay projects including Tara, Yama, and Clairvoyance.

## Why Open Source?

### Reason 1: AI Infrastructure Should Be a Public Good

AI providers are proprietary by necessity -- training large models costs hundreds of millions of dollars. But the orchestration layer -- how you call, manage, fail over, and compose AI providers -- has no reason to be proprietary. The orchestration patterns are well-understood engineering problems: API normalization, retry logic, circuit breakers, streaming, caching.

Open-sourcing NeuroLink contributes to a healthier AI ecosystem where developers focus on building applications rather than re-implementing the same plumbing layer. Every company building AI features today is solving the same infrastructure problems. Why should each of them solve them independently?

### Reason 2: Community Improves the Code Faster Than Any Single Team

Provider APIs change frequently. When OpenAI updates their streaming format, or Anthropic changes their tool calling schema, or Google introduces a new model tier, someone needs to update the SDK.

With a community of developers using different providers in different production environments, issues are caught faster and fixes ship sooner.

Edge cases from diverse environments can improve reliability in ways no single internal team can match. For example, users may uncover concurrency races, timeout behavior on slow connections, or streaming issues with long outputs. Reports and fixes for those cases make the shared abstraction better for everyone.

Provider integrations can likewise benefit from contributors who actively use those platforms. That is how open-source maintenance can compound.

### Reason 3: Trust Through Transparency

Enterprises evaluating AI SDKs need to audit the code. When you pass customer data through a third-party SDK, you need to know what it does with that data. Does it log prompts? Does it phone home? Does it share data with the SDK vendor?

With NeuroLink, the answer is in the source code. Security-sensitive industries -- fintech, healthcare, government -- require full source access. Open source eliminates the "what does this SDK actually do with my data?" question entirely.

NeuroLink is distributed under the MIT License, which permits commercial use, modification, distribution, and private use subject to its copyright and permission notice.

### Reason 4: Ecosystem Compounding

Open standards (MCP) plus open source (NeuroLink) equals maximum interoperability. Tools built on NeuroLink work with other MCP-compatible clients. Blog posts, tutorials, and community content amplify adoption. The SDK improves faster when adoption is wider.

This is the flywheel: more users create more feedback, which produces better code, which attracts more users. Open source is a distribution model that can create this compounding effect.

## What We Open-Sourced

The complete feature set. No "community edition" versus "enterprise edition." Everything is in the open repository.

| Module | Description | Source Path |
|---|---|---|
| **Core SDK** | NeuroLink class, generate(), stream() | `src/lib/neurolink.ts` |
| **Provider integrations** | Native providers, catalog-backed providers, and an OpenAI-compatible adapter | `src/lib/providers/` |
| **MCP Ecosystem** | Tool registry, server manager, 4 transports, OAuth | `src/lib/mcp/` |
| **RAG Pipeline** | 10 chunkers, hybrid search, Graph RAG, reranking | `src/lib/rag/` |
| **Workflow Engine** | Ensemble, chain, adaptive, custom | `src/lib/workflow/` |
| **Server Adapters** | Hono, Express, Fastify, Koa | `src/lib/server/adapters/` |
| **Middleware** | Analytics, guardrails, custom pipelines | `src/lib/middleware/` |
| **HITL** | Human-in-the-loop approval workflows | `src/lib/hitl/` |
| **Memory** | Redis, in-memory conversation management | `src/lib/memory/`, `src/lib/core/` |
| **Observability** | OpenTelemetry, Langfuse integration | `src/lib/services/server/ai/observability/` |
| **CLI** | 30+ commands for setup, generation, evaluation, MCP, RAG, and serving | `src/cli/` |
| **Types** | Full TypeScript type system | `src/lib/types/` |

The published package and repository expose the SDK under a standard open-source license rather than splitting the implementation into a public wrapper and a closed provider layer.

## The MIT License

NeuroLink uses the MIT License. Its short, permissive terms allow people and organizations to use, copy, modify, merge, publish, distribute, sublicense, and sell the software, provided they retain the copyright and permission notice.

For adopters, that means:

- **Commercial use is permitted**: NeuroLink can be included in proprietary products.
- **Modification and distribution are permitted**: Teams can adapt the SDK and redistribute their changes.
- **There is no copyleft requirement**: Using or modifying NeuroLink does not itself require an application's source code to be published.
- **The warranty terms are explicit**: The software is provided "as is," without warranty, as stated in the license.

Organizations should still have their legal teams review the license for their own use case.

## What We Learned from Open-Sourcing

For other teams considering open-sourcing internal tools, here are our lessons:

### Documentation Must Stand on Its Own

Internal teams have tribal knowledge. They know which configuration options are important, which are legacy, and which are dangerous. External users have none of this context, so public APIs, configuration options, and error messages need documentation that a first-time user can understand.

Documentation is not a follow-up task -- it is a prerequisite for a usable open-source project.

### API Surface Design Became Critical

Breaking changes in internal tools are annoying. Breaking changes in open source are costly because users build on the public API. A deliberate exported surface, semantic versioning, and clear migration guidance reduce that cost.

### Testing Coverage Mattered More

External users can encounter different Node.js versions, operating systems, network conditions, and provider-account configurations. Tests should therefore cover supported public behavior rather than only one internal deployment.

### Community Management Is a Skill

Responding to issues, reviewing PRs, and maintaining a welcoming environment requires dedicated effort. NeuroLink publishes contributor guidance and a code of conduct so expectations are visible to prospective contributors.

### Open Source Is Marketing

Developers who use NeuroLink become advocates. They write blog posts, answer questions, and recommend it to colleagues. This organic reach is more effective than any paid marketing campaign, and it targets exactly the right audience: developers who build AI applications.

### Feedback Loop Accelerated

Bug reports from diverse environments can reveal assumptions that internal testing misses. A useful feedback loop turns reproducible reports into regression tests and documented fixes.

### Internal Culture Shifted

Public code invites scrutiny. Clear abstractions, useful error messages, and reviewable changes make the project easier for both maintainers and external contributors to understand.

### Prioritization Became Community-Driven

Public issue reports and discussions can surface use cases beyond the original team's priorities, such as provider-specific rate limits, self-hosted endpoints, and different conversation-memory requirements. Maintainers can use that evidence when prioritizing broadly useful changes.

## How to Contribute

We have designed clear paths for community participation at every skill level:

- **Bug reports**: File GitHub issues with reproduction steps. Even a bug report without a fix is valuable.
- **Provider integrations**: Propose a native adapter or a catalog entry, depending on how much provider-specific behavior is required.
- **MCP servers**: Connect any standards-compliant MCP server or improve NeuroLink's MCP transports and tooling.
- **Documentation**: Improve guides, add examples, fix typos. Low-barrier, high-impact contributions.
- **Testing**: Integration tests across providers. Particularly valuable because they require access to different provider accounts.
- **Blog posts**: Share your NeuroLink projects and patterns. We feature community content on the blog.

The source tree separates provider implementations, catalog metadata, middleware, MCP infrastructure, and public types. Before adding code, use the contribution guide and existing implementation in the same subsystem as the reference.

### Example: Connecting an OpenAI-Compatible Provider

A service that already implements the OpenAI API does not require a new internal adapter. Configure its endpoint and use NeuroLink's public provider ID:

```bash
export OPENAI_COMPATIBLE_BASE_URL="http://localhost:8080/v1"
export OPENAI_COMPATIBLE_API_KEY="optional-api-key"
```

```typescript
import { NeuroLink } from "@juspay/neurolink";

const neurolink = new NeuroLink();
const result = await neurolink.generate({
  input: { text: "Summarize the latest deployment notes." },
  provider: "openai-compatible",
  model: "your-model-name",
});

console.log(result.content);
```

A native provider contribution is appropriate when the API needs provider-specific authentication, request mapping, streaming, tools, or telemetry that the compatible adapter cannot represent.

## Community Governance

Open-sourcing code is the easy part. Building a sustainable community requires governance structures that balance speed with inclusivity.

NeuroLink's public repository includes `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`. Contributors should use those documents for the current development workflow, review expectations, and community standards.

For substantial changes, start with an issue that explains the problem, intended public behavior, compatibility impact, and test plan. Keeping design discussion attached to the repository gives maintainers and users a durable rationale for the resulting change.

## Conclusion

Open-sourcing NeuroLink makes its provider abstraction, MCP integration, RAG, workflows, evaluation, and operational tooling inspectable and reusable. The practical next step is to try the public API, report reproducible issues, and contribute improvements through the repository's documented workflow.

---

**Related posts:**

- [Vector Database Guide: Pinecone vs Qdrant vs pgvector with NeuroLink](/posts/vector-database-guide/)
- [Contributing to NeuroLink: A Complete Guide](/posts/community-contributions/)
- [Getting Started with NeuroLink: Your First AI App in 5 Minutes](/posts/getting-started-first-ai-app/)
