---
layout: post
title: 'From User Input to Provider API — The Five-Stage Message Flow'
date: '2026-06-02 10:00:00 +0530'
categories:
  - Deep Dive
  - Engineering
tags:
  - neurolink
author: neurolink
description: >-
  From User Input to Provider API — The Five-Stage Message Flow — companion deep-dive for the NeuroLink blog with architectural detail and code examples.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/from-user-input-to-provider-api-the-five-stage-message-flow/hero.png
  alt: 'From User Input to Provider API — The Five-Stage Message Flow'
---

We designed NeuroLink's message pipeline after a single user uploading a large PDF took down our entire Claude-proxy service. The request contained a valid PDF, but its size exhausted the memory of the container processing the API call, causing a cascade failure that blocked all subsequent requests to Anthropic. It was a classic, painful lesson: user input is a hostile environment. To build a reliable AI platform, you cannot just forward a user's request to a provider; you must sanitize, structure, and secure it first. That incident led to our five-stage message flow, a robust pipeline that turns chaotic user input into a clean, provider-ready API call.

This post walks through that five-stage flow. It is the core of NeuroLink's reliability, the reason we can handle thousands of concurrent requests mixing text, images, PDFs, and CSVs without crashing. Each stage is a gate, a transformation, and a validation step.

```mermaid
graph TD
    subgraph "User Input"
        A[Raw Request: string | object | array]
    end

    subgraph "NeuroLink Message Pipeline"
        B["Stage 1: Normalize (buildMessagesArray)"]
        C["Stage 2: Process Files (ProcessorRegistry)"]
        D["Stage 3: Enforce Budgets (enforceFileBudget)"]
        E["Stage 4: Build Prompt (buildMultimodalMessagesArray)"]
        F["Stage 5: Adapt to Provider (ProviderImageAdapter)"]
    end

    subgraph "Provider API"
        G[Formatted Request: e.g., Claude API format]
    end

    A --> B;
    B --> C;
    C --> D;
    D --> E;
    E --> F;
    F --> G;
```

## Stage 1: Normalizing Chaotic Inputs

The first stage is pure normalization. User input arrives in a variety of shapes. A simple chat might be a string. A more complex turn could be an array of objects, some with text and some with file references. We have no guarantees about structure.

The entry point to the pipeline, `buildMessagesArray`, takes this chaos and imposes order. Its first job is to ensure every part of the incoming message is a valid, known type.

We run checks like `isValidRole` to confirm the message is from a `user`, `assistant`, or `system`. We use `isValidContentItem` to recursively validate the structure of the content itself. Anything that fails validation is rejected immediately, before any expensive processing begins.

The goal is to convert a mix of inputs into a single, predictable `ChatMessage[]` array. This canonical format is the foundation for every subsequent stage.

```typescript
// Before: Input can be anything
const rawInput1 = "Hello, world!";
const rawInput2 = [
  { type: "text", text: "Analyze this image." },
  { type: "image", source: { type: "path", path: "/tmp/chart.png" } }
];

// After Stage 1: A predictable, validated structure
const normalizedMessages = [
  {
    role: "user",
    content: [
      { type: "text", text: "Analyze this image." },
      {
        type: "file",
        source: { type: "path", path: "/tmp/chart.png" },
        processed: false
      }
    ]
  }
];
```

This strict, upfront normalization prevents entire classes of downstream errors. The rest of the system doesn't need to handle malformed data because it never sees any.

## Stage 2: Detecting and Processing Files

Once we have a normalized message structure, we turn our attention to files. A file path or a buffer is not useful to a vision model. It needs to be identified, parsed, and converted into a format the model can understand.

This is the job of the `ProcessorRegistry`. It is a central, extensible system for handling file types. When `processUnifiedFilesArray` encounters a file, it doesn't just look at the extension. It uses `inferFileTypeFromBuffer` to inspect the file's magic numbers, guaranteeing we identify a PDF even if it's named `file.txt`.

The registry then finds a matching processor. We ship default processors for PDFs, images, and CSVs, but developers can register their own. The PDF processor might extract text and render pages as images. The CSV processor uses `buildCSVToolInstructions` to generate a structured summary that an LLM can query.

```typescript
// In the ProcessorRegistry setup
// This is a conceptual example of registering a handler.

// The registry uses this to find the right tool for the job.
registry.register({
  name: 'pdf-processor',
  mimetypes: ['application/pdf'],
  confidence: 0.8,
  process: async (file: FileWithMetadata) => {
    // 1. Extract text from the first N pages
    // 2. Render first page as a preview image
    // 3. Return a structured object
    return {
      textContent: "...",
      previewImage: "data:image/jpeg;base64,..."
    };
  }
});
```

This registry-based approach makes the system incredibly flexible. Adding support for a new file type is as simple as writing a new processor function and registering it. No core pipeline logic needs to change.

## Stage 3: Enforcing Budgets and Constraints

This is the stage that would have prevented our original production outage. After files are processed, but before we assemble the final prompt, we enforce strict budgets.

The `enforceFileBudget` function is ruthless. It inspects the output of the file processors and the overall message history. It checks:

- Total token count of all text in the conversation.
- Number and resolution of all images.
- Total size of all file-related content.

If any budget is exceeded, we take action. For long conversation histories, this might involve calling a summarization model, a pattern we discuss in [Conversation Summarization: Smart Context Management for Long Chats](/posts/conversation-summarization-patterns/). For images that are too large, we downscale them. For file content that is too verbose, we truncate it.

```typescript
// Inside enforceFileBudget logic
function checkAndEnforceImageLimits(messages: ModelMessage[]): ModelMessage[] {
  const MAX_IMAGES = 10;
  let currentImageCount = 0;

  for (const message of messages) {
    currentImageCount += countImagesInMessage(message);
  }

  if (currentImageCount > MAX_IMAGES) {
    // This is where we would truncate, downsample, or throw an error.
    // For now, we log it. This is where our observability pipeline is critical.
    MultimodalLogger.logError("BudgetExceeded", new Error("Image count exceeds limit"), {
      count: currentImageCount,
      limit: MAX_IMAGES
    });
    // In a real scenario, we'd trim the images here.
  }
  return messages;
}
```

This stage is non-negotiable. It is the circuit breaker that protects both our own infrastructure and the provider's API from abuse, accidental or otherwise. We log every enforcement action, giving us a clear view into how users are interacting with the system, which is invaluable for [OpenTelemetry for AI: Tracing Every Token Through Your Pipeline](/posts/opentelemetry-ai-observability/).

## Stage 4: Building the Multimodal Prompt

With normalized, processed, and budget-compliant content, we are finally ready to build the prompt. This happens in `buildMultimodalMessagesArray`.

This function's job is to arrange the text and file content into the interleaved format that modern multimodal models expect. It takes the structured output from the file processors—like base64-encoded images or extracted text—and weaves it into the `content` array alongside the user's original text.

It also invokes `buildMultimodalSystemPrompt`, which constructs a system prompt containing metadata about the attached files. For a CSV file, the system prompt might include the column headers and data types, giving the model crucial context for answering questions about the data.

```typescript
// The output of buildMultimodalMessagesArray
// A clean, structured, interleaved prompt.
const finalPromptStructure = [
  {
    role: "user",
    content: [
      { type: "text", text: "What is the trend in this chart?" },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: "iVBORw0KGgoAAAANSUhEUg...",
        }
      },
      { type: "text", text: "And compare it against the data in this file." },
      {
        type: "tool_use", // Or a text block with file summary
        id: "file_aBcDeF",
        name: "file_summary.txt",
        input: { summary: "..." }
      }
    ]
  }
];
```

The output of this stage is our internal, canonical representation of a multimodal request. It is perfectly structured and ready for the final translation step.

## Stage 5: Adapting to the Provider

The final stage acknowledges a simple reality: every AI provider has a different API. Anthropic's format for multimodal messages is different from OpenAI's, which is different from Google's Gemini API.

The `ProviderImageAdapter` is a classic adapter pattern. It's a translation layer that converts our canonical message format into the specific JSON structure the target provider expects. The `convertToModelMessages` function orchestrates this, using helper functions like `ProviderImageAdapter.convertToContent` to handle the final conversion.

This adapter knows which providers `supportsVision` and which models within that provider can handle images. It knows that one provider expects a flat array of content blocks while another expects a nested structure. This is also where a strategy for [Dynamic Model Selection: Routing AI Requests at Runtime](/posts/dynamic-model-selection-runtime/) can be implemented, choosing the best provider and model for the given content.

```typescript
// Conceptual: Adapting the same message for two providers

// For Anthropic Claude:
const claudePayload = {
  model: "claude-3-opus-20240229",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What is in this image?" },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "..." } }
      ]
    }
  ]
};

// For Google Gemini:
const geminiPayload = {
  contents: [
    {
      role: "user",
      parts: [
        { text: "What is in this image?" },
        { inline_data: { mime_type: "image/jpeg", data: "..." } }
      ]
    }
  ]
};
```

By isolating provider-specific logic in this final stage, the rest of the pipeline remains clean and agnostic. If a provider changes its API, we update one adapter, not our entire codebase. If we want to add a new provider, we add a new adapter. This design is the key to our ability to rapidly integrate new models and capabilities.

---

**Related posts:**

- [How We Test NeuroLink: 20 Continuous Test Suites and Counting](/posts/neurolink-testing-20-test-suites/)
- [Dynamic Model Selection: Routing AI Requests at Runtime](/posts/dynamic-model-selection-runtime/)
- [OpenTelemetry for AI: Tracing Every Token Through Your Pipeline](/posts/opentelemetry-ai-observability/)
