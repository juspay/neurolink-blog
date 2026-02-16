---
layout: post
title: 'Why We Built NeuroLink: Our Origin Story'
date: '2025-06-08 10:00:00 +0530'
categories:
  - Company
  - Story
tags:
  - origin-story
  - neurolink
  - juspay
  - ai-sdk
  - founding
author: neurolink
description: >-
  The story behind NeuroLink - why we built a unified AI SDK and what problems
  we're solving.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/why-we-built-neurolink/hero.png
  alt: 'Why We Built NeuroLink: Our Origin Story'
---

> **Note:** This narrative presents common challenges developers face when integrating multiple AI providers. Timeline details are illustrative.
{: .prompt-info }

No single AI provider SDK will survive the next five years unchanged. Anyone betting their entire stack on one vendor's API surface is building on sand.

That is the conviction that led us to build NeuroLink. Not as a theoretical exercise, but because we lived the consequences of provider lock-in at Juspay -- one of India's largest payment orchestrators -- and decided the status quo was unacceptable.

## The Problem That Started It All

It began, as many engineering challenges do, with a simple requirement. We wanted to integrate AI capabilities into our payment orchestration platform. The technology was maturing rapidly, and we saw tremendous potential in using large language models to improve developer experience, automate repetitive tasks, and create more intelligent tooling.

What could be simpler? Pick an AI provider, read the documentation, write some code, and ship it.

Except nothing was simple.

Our first integration was with OpenAI's GPT-4. The API was well-documented, and within a few days, we had a working prototype. Success, right? Not quite. We quickly realized that for production workloads, we needed redundancy. What happens when OpenAI has an outage? Our entire AI-powered feature would go dark.

So we added Anthropic's Claude as a fallback. Reasonable enough. But Claude's API was different. The request formats were different. The response structures were different. The error handling was different. The streaming implementations were different. What started as a simple integration became a sprawling mess of conditional logic, adapter patterns, and provider-specific code paths.

Then came the requests from different teams. "Can we try Google's Gemini for this use case?" "Azure OpenAI would work better for our enterprise clients." "What about using local models for sensitive data?"

Each new provider meant more adapters, more edge cases, more testing matrices, more maintenance burden. Our AI integration code was growing faster than our actual feature development.

## The Breaking Point

The breaking point came during a particularly intense sprint. We were debugging an issue in our AI pipeline and realized that we couldn't even properly trace what was happening. Each provider had different logging formats. Our observability tools couldn't make sense of the fragmented data. We were flying blind.

One of our senior engineers, frustrated after another late-night debugging session, asked the question that would eventually lead to NeuroLink: "Why isn't there just a standard way to talk to all of these models?"

It was such a simple question. And the more we thought about it, the more we realized that the answer wasn't "because it's technically impossible." The answer was "because no one had built it yet."

We weren't the only ones feeling this pain. When we talked to other engineering teams—at fintech companies, at startups, at enterprises—we heard the same stories. Everyone was building their own abstraction layers. Everyone was maintaining their own provider adapters. Everyone was solving the same problems in isolation.

It was collective madness. Brilliant engineers across the industry were spending countless hours on plumbing that added no unique value to their products.

## The Decision to Build

The decision to build NeuroLink wasn't made lightly. We knew the scope of what we were taking on. This wasn't a weekend project or a quick hackathon win. This was infrastructure work—the kind of deep, unglamorous engineering that requires patience, rigor, and a long-term commitment.

We had three choices:

1. **Continue with the status quo.** Keep maintaining our growing pile of adapter code and accept the technical debt as a cost of doing business.

2. **Wait for someone else to solve it.** Surely some well-funded startup or a big tech company would build the unified AI SDK we needed. We could just wait.

3. **Build it ourselves.** Take our hard-won learnings and create something that would solve the problem not just for us, but for everyone.

We chose option three. Not because we thought we were uniquely qualified, but because we had something valuable: real production experience with multi-provider AI systems at scale. We knew where the sharp edges were because we had cut ourselves on them.

## Building the First Version

The first version of NeuroLink was embarrassingly simple. It was essentially a thin wrapper around our existing internal abstractions, hastily packaged into something that could theoretically be used outside of Juspay.

But even that minimal version taught us something important: simplicity was the killer feature.

Developers didn't want another complex framework with a steep learning curve. They wanted to write one line of code and have it work with any model. They wanted to swap providers without changing their application logic. They wanted sensible defaults that just worked.

We stripped away everything that wasn't essential. We obsessed over the developer experience. We wrote and rewrote the core APIs until they felt natural.

The unified interface emerged through iteration:

```typescript
// Before NeuroLink - different code for each provider
// OpenAI
const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello" }]
});

// Anthropic
const anthropic = new Anthropic();
const response = await anthropic.messages.create({
  model: "claude-3-opus",
  messages: [{ role: "user", content: "Hello" }]
});

// After NeuroLink - one interface, any provider
import { NeuroLink } from "@juspay/neurolink";

const ai = new NeuroLink();
const result = await ai.generate({
  input: { text: "Hello" },
  provider: "openai",  // or "anthropic", or any provider
  model: "gpt-4"       // or "claude-3-opus", or any model
});
console.log(result.content);
```

This might look like a small change, but the implications were profound. With a unified interface, we could add intelligent routing. We could implement automatic fallbacks. We could provide consistent observability across all providers.

Each capability built on the foundation of that simple, unified interface.

### Why TypeScript, and Why Provider Abstraction

Early on we made two architectural bets that shaped everything that followed.

The first was choosing TypeScript as our primary language. We considered Python -- it dominates the ML ecosystem -- but most of our users were building web applications and backend services in Node.js. TypeScript gave us something Python could not: compile-time guarantees about provider response shapes. When Anthropic changed a field name in a minor release, our type system caught it before any user hit a runtime error. That confidence compounded as we added more providers.

The second bet was the provider abstraction pattern over thin wrappers. Wrappers preserve each vendor's surface area and just smooth over rough edges. An abstraction defines a canonical model and maps providers into it. Wrappers are easier to build but force callers to know which provider they are talking to. Abstractions cost more upfront -- you have to decide what the canonical response looks like -- but they unlock features like failover, load balancing, and transparent provider swapping that are structurally impossible with wrappers.

We also chose an event-based architecture over raw callbacks for streaming. Callbacks create deeply nested code and make it painful to add cross-cutting concerns like logging or token counting. Events gave us a clean separation: the provider adapter emits typed events, and any number of listeners can observe the stream without coupling to each other. When we later added middleware support, the event system meant we could intercept and transform streaming data without touching provider code at all.

There was also the question of how to handle provider-specific model names. OpenAI uses `gpt-4`, Anthropic uses `claude-3-opus-20240229`, Google uses `gemini-1.5-pro`. We debated whether to create our own alias system -- something like `neurolink:large` that would resolve to the best available model -- but ultimately decided against it. Aliases hide important information and make debugging harder. Instead, we kept model names transparent and invested in tooling that helps developers discover and compare models across providers. Keeping things explicit was a recurring theme in our design philosophy: magic is convenient until something breaks, and then it becomes an obstacle.

## The Team That Made It Happen

NeuroLink wouldn't exist without the incredible team that brought it to life. We were fortunate to have engineers who had worked across the AI landscape—people who had implemented ML systems at scale, who understood the intricacies of different model architectures, who cared deeply about developer experience.

Our core team brought together diverse expertise: systems engineers who obsessed over performance and reliability, API designers who agonized over every function name and parameter, ML engineers who understood the nuances of different models and providers, and infrastructure engineers who knew how to build things that scale.

But beyond technical skills, what united us was a shared frustration with the status quo and a belief that we could do better. We had all experienced the pain of fragmented AI tooling. We all wanted to fix it.

We also benefited enormously from being part of Juspay. Having a production environment to test our ideas meant we could iterate quickly and validate our assumptions against real workloads. We weren't building in a vacuum—we were building for actual use cases that we encountered every day.

## Early Adopter Feedback

Before we open sourced anything, we shared early builds with a handful of teams outside Juspay -- two fintech startups, a healthcare SaaS company, and an internal tools team at a mid-size e-commerce firm. We gave them access to a private npm package and asked them to integrate it into a real project, not a toy demo. Their feedback was humbling and invaluable.

The first thing we heard, almost universally, was that our error messages were terrible. We had inherited the raw error payloads from each provider, and when something went wrong, developers received a cryptic blob that only made sense if they already knew which vendor was being called. We rewrote the entire error layer to produce normalized, human-readable messages that included the provider name, the HTTP status, and a suggested fix.

The healthcare team pushed us hard on streaming reliability. Their use case involved generating clinical summaries in real time, and they could not afford dropped chunks or silent failures mid-stream. Their bug reports led us to build automatic reconnection logic and a buffered event replay mechanism that became one of NeuroLink's most valued features.

Perhaps the most surprising feedback came from the e-commerce team. They didn't care about switching providers -- they used only OpenAI. What they loved was the unified observability. For the first time they could see token counts, latency percentiles, and cost estimates in a single dashboard without stitching together three different logging formats. That told us something we had underestimated: even single-provider teams benefit from a well-designed abstraction layer because it imposes structure that raw SDKs do not.

One fintech startup gave us a piece of feedback that reshaped how we think about configuration. They had different compliance requirements for different markets and needed to route EU traffic through Azure OpenAI while keeping US traffic on direct OpenAI endpoints. Their existing code had environment-specific if-else chains scattered across dozens of files. When they saw that NeuroLink could express this as a declarative routing config, their lead engineer said it would save them weeks of refactoring. That conversation pushed us to invest heavily in the configuration system long before we had planned to.

We changed our roadmap significantly based on these conversations. Observability moved from "nice to have later" to a first-class pillar. Streaming became the most tested code path in the project. And we adopted a policy that every error message must be actionable -- if a developer reads it at 2 AM, they should know what to try next.

Looking back, those early adopter conversations were worth more than months of internal speculation. We had been guessing at what external developers would care about, and we got it partially wrong. The lesson was clear: ship early to real users, listen harder than you talk, and be willing to rearrange your priorities when the evidence demands it.

## The Open Source Decision

One of the most important decisions we made was to open source NeuroLink. This wasn't obvious at the time. We had invested significant resources in building this technology. Wouldn't it make more sense to keep it proprietary and build a commercial product around it?

We thought long and hard about this, and ultimately we concluded that open source was the right choice for several reasons.

First, the problem we were solving was universal. Every company building with AI was facing the same challenges. A closed-source solution would only help a fraction of them.

Second, we believed that the best infrastructure is built in the open. The most reliable, well-designed developer tools tend to be open source projects that benefit from community contributions, scrutiny, and feedback.

Third, we had benefited enormously from open source software throughout our careers and throughout Juspay's history. This was an opportunity to give back to the community that had given us so much.

Finally, we recognized that our competitive advantage as a company doesn't come from hoarding basic infrastructure. It comes from how we use that infrastructure to solve real problems. By open sourcing NeuroLink, we could focus our proprietary efforts on higher-level capabilities while giving the community a solid foundation to build on.

## What We Learned Along the Way

Building NeuroLink taught us lessons that went far beyond the technical.

**Lesson one: Start with the pain, not the solution.** It's tempting to get excited about technology and build cool things. But the most impactful projects start with a deep understanding of real problems. We didn't set out to build a unified AI SDK. We set out to solve the painful fragmentation we were experiencing. The SDK was just the most effective solution we found.

**Lesson two: Developer experience is not a nice-to-have.** The best infrastructure in the world is useless if developers hate using it. We invested heavily in making NeuroLink intuitive, well-documented, and pleasant to work with. Every API decision went through the filter of "would we enjoy using this?"

**Lesson three: Embrace constraints.** We could have tried to build a maximalist platform that did everything. Instead, we embraced constraints. NeuroLink does one thing well: it provides a unified interface to AI models. By staying focused, we were able to make that one thing excellent.

**Lesson four: Feedback is gold.** The early adopters who took a chance on NeuroLink when it was rough around the edges provided invaluable feedback. They showed us where our assumptions were wrong, where our documentation was confusing, where our APIs were awkward. Every piece of criticism made the project better.

**Lesson five: Open source is a superpower.** When we open sourced NeuroLink, we were nervous. What if no one cared? What if we got harsh criticism? Instead, we found a community of developers who shared our vision and wanted to help make it real. Contributors fixed bugs, added providers, improved documentation, and pushed us to do better.

**Lesson six: Provider APIs change under your feet.** We learned the hard way that AI vendors ship breaking changes far more frequently than traditional cloud APIs. A model gets deprecated with two weeks' notice. A response field gets renamed. A streaming format changes subtly between minor versions. Building NeuroLink forced us to develop rigorous integration tests that run against live provider endpoints on a schedule, catching regressions before our users do. That testing discipline became a core part of how we operate.

**Lesson seven: Abstractions must be escape-hatchable.** No matter how good your unified interface is, someone will need to pass a provider-specific parameter that you did not anticipate. Early versions of NeuroLink were too opinionated -- we swallowed vendor-specific options to keep the API clean. Experienced users pushed back hard. We added a `providerOptions` passthrough that lets callers send arbitrary fields to the underlying SDK without breaking the abstraction for everyone else. The lesson: a good abstraction covers ninety percent of cases elegantly and gets out of the way for the remaining ten.

**Lesson eight: Documentation is part of the product.** We initially treated docs as an afterthought -- something to write once the code stabilized. That was a mistake. Every week we delayed documentation, we received the same questions over and over again. When we finally committed to writing comprehensive guides alongside every feature, our support burden dropped dramatically and adoption accelerated. The code and the docs had to ship together, or neither was truly finished.

## The Vision for NeuroLink

Where is NeuroLink headed? Our vision is ambitious but grounded in the same practical philosophy that guided our initial development.

We want NeuroLink to be the standard way that developers interact with AI models. Not because we're prescriptive about architecture, but because standardization unlocks so much value. When everyone speaks the same language, tools can be shared, patterns can be reused, and the whole ecosystem becomes more productive.

We've expanded beyond simple chat completions to support additional AI capabilities. Image generation is now available (since v8.31.0), and text-to-speech has been supported since v8.15.0. Each new capability follows the same principle: provide a unified interface that works consistently across all 12 supported providers.

We're investing heavily in observability and debugging tools. Understanding what your AI systems are doing—and why—is crucial for building reliable applications. NeuroLink aims to make AI behavior as transparent and debuggable as any other part of your stack.

We're building more sophisticated routing and optimization capabilities. As AI applications mature, developers need more control over how requests are distributed, how costs are managed, and how performance is optimized. NeuroLink will provide the primitives to make these decisions intelligently.

Most importantly, we're committed to remaining open and community-driven. The best ideas often come from unexpected places, and some of our most impactful features started as community pull requests. We want NeuroLink to be a project that belongs to its community, not just to its original creators.

## An Invitation

The AI infrastructure space is littered with projects that optimize for hype over substance. We have taken the opposite position: build for production first, talk about it second.

If you have spent hours debugging provider-specific quirks, if you have winced at the cost of rewriting your integration layer for the third time, if you believe that developer tools should earn trust through reliability rather than marketing -- NeuroLink was built for you.

Try it. Break it. Tell us what is wrong. The best infrastructure is shaped by the people who depend on it, not by the people who built it.

We are not claiming NeuroLink is perfect. We are claiming it was built by people who understand the problem because they lived with it every day, in production, at scale. Every design decision reflects a lesson we learned the hard way.

That is why we open sourced NeuroLink. Not because it was the trendy choice, but because we believe the best tools are the ones we build together.

---

*The NeuroLink team continues to work on expanding capabilities, improving reliability, and making AI development more accessible to developers everywhere. Join us on [GitHub](https://github.com/juspay/neurolink) to follow our progress and contribute to the project.*

---

**Related posts:**

- [What is NeuroLink? The Unified AI SDK Explained](/posts/what-is-neurolink-unified-sdk/)
- [Welcome to the NeuroLink Blog](/posts/welcome-to-neurolink-blog/)
