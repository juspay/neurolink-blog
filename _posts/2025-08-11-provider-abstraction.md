---
layout: post
title: 'How We Built NeuroLink''s Provider Abstraction: 13 APIs, One Interface'
date: '2025-08-11 10:00:00 +0530'
categories:
  - Deep Dive
  - Architecture
tags:
  - architecture
  - provider-abstraction
  - design-patterns
  - typescript
  - sdk-design
  - ai-providers
author: neurolink
description: >-
  Learn how NeuroLink unifies 13 AI provider APIs behind a single TypeScript
  interface using abstract classes, factory patterns, and dynamic registration.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/provider-abstraction/hero.png
  alt: 'How We Built NeuroLink''s Provider Abstraction: 13 APIs, One Interface'
---

The provider layer was a liability. Thirteen SDKs, thirteen authentication flows, thirteen streaming protocols, thirteen error taxonomies -- all leaking into application code through a growing switch statement that nobody wanted to own. OpenAI uses bearer tokens; Bedrock uses AWS Signature V4; Vertex uses Google service accounts; SageMaker uses custom endpoints with per-model input formats. And that is just authentication.

We decomposed it. NeuroLink supports 13 providers -- OpenAI, Anthropic, Google AI Studio, Google Vertex, AWS Bedrock, Azure OpenAI, Mistral, Ollama, LiteLLM, HuggingFace, OpenRouter, OpenAI-Compatible, and Amazon SageMaker -- behind a single `generate()` and `stream()` interface. From your application code, they all look identical.

The constraint that shaped the architecture: **adding a provider must not require changing the factory's routing algorithm.** Built-in providers still add an enum or catalog entry and a registration call, but there is no growing switch statement, conditional import chain, or feature-flag branch to rewrite. The right abstraction is not a wrapper -- it is a contract. This post traces how we built that contract.

## The Public AIProvider Contract

Everything starts with the public `AIProvider` type. This is the contract consumers call, and it is broader than the protected hooks a provider subclass implements.

Its required public methods are:

- **`generate()`** and **`gen()`** -- Non-streaming text generation returning an `EnhancedGenerateResult`
- **`stream()`** -- Streaming generation returning normalized content chunks
- **`embed()`** and **`embedMany()`** -- Single and batch embedding operations
- **`setupToolExecutor()`** -- Connects the provider to NeuroLink's tool executor
- **`setTraceContext()`** -- Propagates tracing context across provider calls

The base class also keeps `generateText()` as a backward-compatibility method, but it is not part of the public `AIProvider` type. Optional capabilities such as `decide()`, file-root policy, tool-support checks, and runtime model-limit discovery extend the contract where relevant.

The critical design decision was the return types. Every provider returns the same `EnhancedGenerateResult` from `generate()`, regardless of whether the underlying model is GPT-5.4, Claude Sonnet 5, or a custom Llama on SageMaker. This means consumer code never needs to handle provider-specific response formats.

For streaming, we made another deliberate choice: the stream yields `{ content: string }` objects via an `AsyncGenerator`. This is simpler than exposing provider-specific stream types (like OpenAI's delta events or Anthropic's content blocks). The normalization happens inside the provider, not in your code.

```typescript
// From src/lib/core/baseProvider.ts - The abstract base class
export abstract class BaseProvider implements AIProvider {
  protected readonly modelName: string;
  protected readonly providerName: AIProviderName;
  protected readonly defaultTimeout: number = 30000;

  // Abstract methods every provider MUST implement
  protected abstract getProviderName(): AIProviderName;
  protected abstract getDefaultModel(): string;
  protected abstract getAISDKModel(): LanguageModel | Promise<LanguageModel>;
  protected abstract formatProviderError(error: unknown): Error;

  // Streaming has a default implementation that delegates to an optional
  // doStream() hook -- override executeStream() directly only if you need
  // full control over the streaming loop.
  protected async executeStream(
    options: StreamOptions,
    analysisSchema?: ValidationSchema,
  ): Promise<StreamResult> {
    /* default implementation */
  }
}
```

These four protected abstract methods are the required `BaseProvider` subclass hooks, not the complete public `AIProvider` interface. A subclass may also override streaming behavior when it needs provider-specific control. Everything else -- including the public interface methods, message building, timeout handling, tool management, telemetry, and analytics -- is inherited from `BaseProvider`.

![Provider Abstraction Layer](/assets/img/posts/provider-abstraction/provider-abstraction-layer.gif)

## BaseProvider: The Template Method Pattern

`BaseProvider` is where the real architectural work happens. It implements the Template Method pattern: the shared workflow is defined in the base class, and subclasses override only the provider-specific steps.

The `generate()` method follows this flow:

1. **Normalize options** -- standardize the input format
2. **Prepare tools** -- validate and format tool definitions
3. **Build messages** -- construct the provider-appropriate message array
4. **Execute generation** -- call the provider's AI SDK (the abstract method)
5. **Enhance result** -- normalize the response into `EnhancedGenerateResult`

Subclasses only implement step 4. Steps 1-3 and 5 are handled by `BaseProvider` and shared across all 13 providers. This eliminates an enormous amount of duplicated code -- and more importantly, duplicated bugs.

### Composition Over Inheritance

Early versions of `BaseProvider` grew into a God class. Every shared utility method -- message formatting, stream handling, telemetry, tool validation -- lived in one massive file. The fix was composition: we extracted responsibilities into focused modules.

```typescript
// From src/lib/core/baseProvider.ts - Composition modules (SRP)
constructor(modelName?, providerName?, neurolink?, middleware?) {
  this.modelName = modelName || this.getDefaultModel();
  this.providerName = providerName || this.getProviderName();

  // Initialize composition modules
  this.messageBuilder = new MessageBuilder(this.providerName, this.modelName);
  this.streamHandler = new StreamHandler(this.providerName, this.modelName);
  this.generationHandler = new GenerationHandler(/* ... */);
  this.telemetryHandler = new TelemetryHandler(/* ... */);
  this.utilities = new Utilities(/* ... */);
  this.toolsManager = new ToolsManager(/* ... */);
}
```

Each module has a single responsibility:

- **MessageBuilder** -- Constructs the message array from user input, handling text, images, and system prompts across providers
- **StreamHandler** -- Manages stream lifecycle, chunk normalization, and abort handling
- **GenerationHandler** -- Orchestrates the generate/stream flow with timeout and retry logic
- **TelemetryHandler** -- Collects per-request metrics (latency, token usage, model, provider)
- **ToolsManager** -- Validates tool schemas, manages tool choice, handles multi-step execution
- **Utilities** -- Shared helpers (timeout wrappers, error formatting, config resolution)

This composition approach means each module can be tested independently, and changes to one area (say, telemetry collection) do not risk breaking another (say, message building).

### Timeout Consolidation

An illustrative example of the value of `BaseProvider`: the `executeWithTimeout()` method. Before we had it, 8 of 10 providers implemented their own timeout logic -- each slightly different, some with bugs. We consolidated it into a single method in `BaseProvider`:

```typescript
// All providers get consistent timeout behavior
protected async executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  const timeout = timeoutMs ?? this.defaultTimeout;
  // AbortController + Promise.race implementation
  // Consistent across all 13 providers
}
```

One implementation, one test suite, one set of timeout semantics across all providers.

## The Provider Enum as Single Source of Truth

The `AIProviderName` enum is the foundation of the entire registration and routing system:

```typescript
// From src/lib/constants/enums.ts
export enum AIProviderName {
  BEDROCK = "bedrock",
  OPENAI = "openai",
  OPENAI_COMPATIBLE = "openai-compatible",
  OPENROUTER = "openrouter",
  VERTEX = "vertex",
  ANTHROPIC = "anthropic",
  AZURE = "azure",
  GOOGLE_AI = "google-ai",
  HUGGINGFACE = "huggingface",
  OLLAMA = "ollama",
  MISTRAL = "mistral",
  LITELLM = "litellm",
  SAGEMAKER = "sagemaker",
  AUTO = "auto",
}
```

*(The provider roster has grown substantially since this post was written -- see the [Provider Comparison Matrix](/posts/provider-comparison-matrix/) for the current full list. The registration pattern below is unchanged: every new provider, then and now, is added the same way.)*

This enum is not just a label -- it drives three critical systems:

### 1. Provider Registration

The `ProviderRegistry` maps enum values to provider factory functions. When you call `generate({ provider: "mistral" })`, the registry looks up `AIProviderName.MISTRAL` and instantiates the correct class.

### 2. Input Normalization

User input strings like `"google-ai"`, `"Google AI"`, `"GOOGLE_AI"`, or `"googleai"` are all normalized to the canonical `AIProviderName.GOOGLE_AI` value before routing. This makes the API forgiving while keeping internal logic strict.

### 3. Environment Variable Resolution

Each enum value maps to provider configuration and a registry default. For OpenAI, an explicit model wins; otherwise factory-created providers use the registry's legacy `gpt-4o-mini` default. The provider class also reads `OPENAI_MODEL` when it is constructed without a model and otherwise uses its own legacy `gpt-4o` default. Those legacy defaults document the current implementation rather than a current model recommendation; new explicit configurations should use a current in-catalog model such as `gpt-5.4-mini` for the balanced tier.

The `AUTO` value is special -- it triggers `createBestAIProvider()`, which scans environment variables for available API keys and selects the best configured provider automatically.

## Adding a New Provider in 4 Steps

This is the ultimate test of an abstraction: how easy is it to extend? Adding a built-in provider requires four focused steps. The provider class is new, while the enum or catalog and registration list receive additive entries; the factory's routing logic does not change.

### Step 1: Create the Provider Class

```typescript
// src/lib/providers/myProvider.ts
import { BaseProvider } from '../core/baseProvider';
import { AIProviderName } from '../constants/enums';

export class MyProvider extends BaseProvider {
  protected getProviderName(): AIProviderName {
    return AIProviderName.MY_PROVIDER;
  }

  protected getDefaultModel(): string {
    return "my-default-model";
  }

  protected getAISDKModel(): LanguageModel {
    // Create and return the Vercel AI SDK model instance
    return createMySDK({ apiKey: process.env.MY_API_KEY });
  }

  protected async executeStream(options, analysisSchema?) {
    // Provider-specific streaming implementation
    const model = this.getAISDKModel();
    const result = await streamText({ model, messages: options.messages });
    return result;
  }

  protected formatProviderError(error: unknown): Error {
    // Classify provider-specific errors
    if (error.message?.includes("invalid_api_key")) {
      return new AuthenticationError("Check MY_API_KEY");
    }
    return new ProviderError(error.message);
  }
}
```

### Step 2: Implement the BaseProvider Hooks

A `BaseProvider` subclass implements four required protected methods, with optional streaming overrides:

- `getProviderName()` -- returns the enum value
- `getDefaultModel()` -- returns the default model identifier
- `getAISDKModel()` -- creates and returns the AI SDK model instance (can be async for providers like OpenAI-Compatible that do auto-discovery)
- `formatProviderError()` -- classifies errors into NeuroLink's error hierarchy
- `executeStream()` -- implements the provider-specific streaming logic (optional to override directly; `BaseProvider` provides a default that delegates to an optional `doStream()` hook)

Everything else -- message building, tool management, telemetry, timeout handling -- is inherited from `BaseProvider`.

### Step 3: Register in the Provider Registry

```typescript
// In ProviderRegistry's registration list
ProviderFactory.registerProvider(
  AIProviderName.MY_PROVIDER,
  (modelName) => new MyProvider(modelName),
  "my-default-model",
  ["my-alias"],
);
```

### Step 4: Add the Enum or Catalog Entry

For a built-in provider, add the new provider to the `AIProviderName` enum and its descriptor/catalog metadata:

```typescript
export enum AIProviderName {
  // ... existing providers
  MY_PROVIDER = "my-provider",
}
```

Direct callers can register string keys through `ProviderFactory.registerProvider()`, but built-in providers use the enum and descriptor catalog for consistent typing, aliases, credentials, and discovery.

### Why the Routing Logic Does Not Change

The key architectural decision is that the factory uses **registration, not conditionals**. There is no switch statement or if-else chain that routes provider names to classes. Instead, the registry adds each provider to a map through `ProviderFactory.registerProvider()`, and the factory looks it up by key. Adding a built-in provider changes the enum/catalog and registration list, but not the factory algorithm.

This is the Open/Closed Principle in practice: the routing mechanism stays closed to modification while its registrations remain open to extension.

## Architecture Diagram

Here is the full architecture showing how the abstraction layers connect:

```mermaid
graph TB
    subgraph "Consumer Code"
        APP[Application]
    end

    subgraph "Abstraction Layer"
        IF[AIProvider Interface]
        BP[BaseProvider Abstract Class]
        MB[MessageBuilder]
        SH[StreamHandler]
        GH[GenerationHandler]
        TH[TelemetryHandler]
        TM[ToolsManager]
    end

    subgraph "Provider Implementations"
        OAI[OpenAIProvider]
        ANT[AnthropicProvider]
        VTX[GoogleVertexProvider]
        BDK[AmazonBedrockProvider]
        AZR[AzureOpenAIProvider]
        GAS[GoogleAIStudioProvider]
        MIS[MistralProvider]
        OLL[OllamaProvider]
        HF[HuggingFaceProvider]
        OR[OpenRouterProvider]
        LLM[LiteLLMProvider]
        OC[OpenAICompatibleProvider]
        SM[SageMakerProvider]
    end

    APP --> IF
    IF --> BP
    BP --> MB
    BP --> SH
    BP --> GH
    BP --> TH
    BP --> TM
    BP --> OAI
    BP --> ANT
    BP --> VTX
    BP --> BDK
    BP --> AZR
    BP --> GAS
    BP --> MIS
    BP --> OLL
    BP --> HF
    BP --> OR
    BP --> LLM
    BP --> OC
    BP --> SM
```

The application talks to the `AIProvider` interface. The interface is implemented by `BaseProvider`, which composes its behavior from focused modules. Each concrete provider extends `BaseProvider` and implements only the provider-specific methods. The consumer never knows (or needs to know) which provider is running underneath.

## Lessons Learned

Building a provider abstraction that covers 13 APIs taught us several lessons that apply to any SDK design.

### Lesson 1: Abstract Classes Beat Pure Interfaces for Shared Behavior

A pure interface defines the contract but cannot enforce shared behavior. We started with interfaces and quickly found ourselves duplicating code across providers -- the same timeout logic, the same message formatting, the same error handling patterns. Abstract classes let us define the contract AND the shared implementation in one place.

The trade-off is reduced flexibility (single inheritance in TypeScript), which we mitigated with composition modules.

### Lesson 2: Composition Modules Prevent God Classes

When `BaseProvider` crossed 800 lines, we knew we had a problem. The fix was not to split it into multiple base classes (which would have forced diamond inheritance), but to extract behavior into composed modules: `MessageBuilder`, `StreamHandler`, `GenerationHandler`, `TelemetryHandler`, `ToolsManager`, and `Utilities`.

Each module has a single responsibility and can be tested independently. `BaseProvider` becomes an orchestrator, not a monolith.

### Lesson 3: Make the Default Path Zero-Config

Most developers should not need to read documentation to get started. NeuroLink's default path uses environment variables for configuration, auto-detection for provider selection, and sensible defaults for everything else. The `AUTO` provider scans your environment and picks the best option automatically.

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();
// If OPENAI_API_KEY is set, uses OpenAI
// If ANTHROPIC_API_KEY is set, uses Anthropic
// No explicit provider selection needed
```

Zero-config for the happy path, full control for the power user.

### Lesson 4: Backward Compatibility Layers Are Worth the Cost

When we renamed `generateText()` to `generate()` for clarity, we kept `generateText()` as an alias that wraps `generate()`. This added a few lines of code but saved every existing user from a breaking migration. In SDK design, backward compatibility is not technical debt -- it is customer respect.

### Lesson 5: The Enum Is the Single Source of Truth

Every time we tried to maintain provider lists in multiple places (enum, registry, factory, documentation), they drifted out of sync. Making the `AIProviderName` enum the single source of truth -- and deriving everything else from it -- eliminated an entire class of bugs.

## What's Next

This post covered the architectural foundation: interface contract, abstract base class, composition modules, enum-driven registry, and the extension pattern. The follow-up posts go deeper into the runtime layer:

- **The Factory + Registry Pattern** -- how providers are instantiated, cached, and managed at runtime
- **Multi-Tenant Provider Routing** -- how the abstraction enables tenant-specific provider selection in SaaS applications
- **[Provider Comparison Matrix](/posts/provider-comparison-matrix/)** -- the practical outcome of this abstraction: all 13 providers compared side by side

If you are building your own multi-provider abstraction, start with the interface contract and the abstract base class. Get those right, and the rest follows. Get them wrong, and you will fight the architecture for the life of the project.

---

**Related posts:**

- [Provider Comparison Matrix: Choosing the Right AI Provider](/posts/provider-comparison-matrix/)
- [How to Switch AI Providers Without Rewriting Code](/posts/switch-ai-providers-without-rewriting/)
- [What is NeuroLink? The Unified AI SDK Explained](/posts/what-is-neurolink-unified-sdk/)
