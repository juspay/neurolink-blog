---
layout: post
title: 'Embeddings and Vector Operations with NeuroLink'
date: '2026-01-23 10:00:00 +0530'
categories:
  - Tutorial
  - Embeddings
tags:
  - embeddings
  - vectors
  - similarity-search
  - rag
  - semantic-search
  - neurolink
author: neurolink
description: >-
  Generate embeddings, compute vector similarity, and build semantic search with
  NeuroLink's unified embedding API. Supports OpenAI, Google, and Vertex AI
  embedding models.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/embeddings-vector-operations/hero.png
  alt: Embeddings and Vector Operations with NeuroLink
---

In this guide, you will implement embeddings and vector operations with NeuroLink. You will generate text embeddings, compute similarity scores, build a simple vector search index, and integrate with vector databases for production-scale semantic search.

At their core, embeddings turn text into numerical vectors that capture semantic meaning. Two pieces of text that mean similar things produce vectors that are close together in high-dimensional space, even if they share no words in common. This property makes embeddings the fundamental building block for semantic search, Retrieval-Augmented Generation (RAG) pipelines, document clustering, and recommendation systems.

NeuroLink provides embedding support across providers, including OpenAI's `text-embedding-3-small`, Google AI's `gemini-embedding-001`, and Vertex AI's `text-embedding-004`. In the inline RAG workflow, you can select an `embeddingProvider` and `embeddingModel` while keeping document and query vectors in the same embedding space.

In this tutorial, you will learn how embeddings work, how to generate them through NeuroLink's RAG pipeline, and how to build semantic search systems that retrieve relevant information for a query.

## How Embeddings Work

The embedding process transforms human-readable text into fixed-dimensional numerical vectors. A sentence like "Machine learning automates pattern recognition" becomes an array of 768 or 1536 floating-point numbers, depending on the model. The magic is that semantically similar sentences produce vectors that are close together in this high-dimensional space.

```mermaid
flowchart LR
    A[Text Input] --> B[Embedding Model]
    B --> C[Vector Output]
    C --> D[Vector Store]

    E[Query Text] --> F[Embedding Model]
    F --> G[Query Vector]
    G --> H{Similarity Search}
    D --> H
    H --> I[Ranked Results]

    style B fill:#4a9eff,color:#fff
    style F fill:#4a9eff,color:#fff
```

### Distance Metrics

Three common metrics measure how close two vectors are:

- **Cosine similarity**: Measures the angle between two vectors, producing a value between -1 and 1. A score of 1 means the vectors point in the same direction (maximum similarity). This is the most commonly used metric because it is insensitive to vector magnitude.
- **Dot product**: Measures the projection of one vector onto another. It is useful for normalized vectors and is slightly faster to compute than cosine similarity.
- **Euclidean distance**: Measures the straight-line distance between two points in vector space. Smaller values indicate greater similarity. This metric is sensitive to vector magnitude.

NeuroLink's RAG system uses embeddings for chunked document retrieval, handling the embedding generation, similarity computation, and result ranking internally. The vector query tool performs similarity search against chunked document embeddings, and the hybrid search module combines vector similarity with keyword matching for improved accuracy.

![Embedding Pipeline](/assets/img/posts/embeddings-vector-operations/embedding-pipeline.gif)

## Generating Embeddings

NeuroLink integrates embedding generation into its RAG pipeline. When you provide document sources and a query, the pipeline automatically chunks the documents, generates embeddings for each chunk, embeds the query, and retrieves the most relevant chunks.

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Generate embeddings via the RAG pipeline
const result = await neurolink.generate({
  input: { text: "What is machine learning?" },
  provider: "google-ai",
  rag: {
    files: ["./docs/ml-guide.md"],
    chunkSize: 500,
    chunkOverlap: 50,
  },
});
```

### Provider-Specific Embedding Models

Different providers offer different embedding models, each with its own characteristics:

| Provider | Model | Selection |
|---|---|---|
| **OpenAI** | text-embedding-3-small | Set `embeddingProvider: "openai"` and `embeddingModel: "text-embedding-3-small"` |
| **OpenAI** | text-embedding-3-large | Set both fields with `embeddingModel: "text-embedding-3-large"` |
| **Google AI** | gemini-embedding-001 | Set `embeddingProvider: "google-ai"` and `embeddingModel: "gemini-embedding-001"` |
| **Vertex AI** | text-embedding-004 | Set both fields with `embeddingModel: "text-embedding-004"` |

The inline RAG configuration within `GenerateOptions` accepts `files`, `strategy`, `chunkSize`, `chunkOverlap`, `topK`, `toolName`, `toolDescription`, `embeddingProvider`, and `embeddingModel`. With current v12 behavior, configure `embeddingProvider` and `embeddingModel` together: omitting the model substitutes the generation model `gemini-2.5-flash`, which is not a safe embedding default for another provider. If provider creation or index-time embedding fails, NeuroLink rebuilds the entire index with its deterministic fallback and uses that fallback for later queries. A provider failure that first occurs at query time hashes only that query, however, so applications that require strict embedding-space consistency should reject or retry that query rather than relying on the fallback.

> **Note:** Always use the same embedding model for both document embeddings and query embeddings. Mixing models (for example, embedding documents with OpenAI but querying with Google) produces meaningless similarity scores because the vector spaces are incompatible.
{: .prompt-info }

![embed-api](/assets/img/posts/embeddings-vector-operations/embed-api.gif)

## The RAG Pipeline: Embeddings in Action

NeuroLink's RAG pipeline handles the full lifecycle from raw documents to AI-generated answers. Understanding each stage helps you tune the pipeline for your specific use case.

```mermaid
flowchart TD
    A[Document Sources] --> B[Document Loader]
    B --> C[Chunking]
    C --> D[Embedding Generation]
    D --> E[Vector Store]

    F[User Query] --> G[Query Embedding]
    G --> H[Vector Search]
    E --> H
    H --> I[Reranking]
    I --> J[Context Assembly]
    J --> K[LLM Generation]
    K --> L[Response]

    subgraph "Retrieval"
        H
        I
        J
    end
```

### Pipeline Components

NeuroLink provides two related RAG paths:

**Inline RAG for `generate()` and `stream()`** -- The `rag` option loads local files, chooses or auto-detects one of NeuroLink's chunking strategies, indexes the chunks in an in-memory vector store, and injects a search tool the model can call. It is the shortest path from files to a grounded response.

**Advanced `RAGPipeline`** -- The standalone pipeline supports optional hybrid search, reranking, graph retrieval, metadata extraction, and resilience controls. These features are configured on the pipeline; they are not switched on merely by passing the inline `rag` object shown above.

For persistent deployments, NeuroLink also includes Pinecone, pgvector, and Chroma vector-store adapters in addition to the in-memory store. Choose one of those adapters when the index must survive process restarts or scale beyond one application instance.

### Advanced RAG Configuration

For more control over retrieval, you can specify detailed RAG parameters:

```typescript
const result = await neurolink.generate({
  input: {
    text: "What are the key findings from the research paper?",
  },
  provider: "vertex",
  rag: {
    files: ["./research-notes.md", "./supplementary-data.csv"],
    strategy: "recursive",
    chunkSize: 1000,
    chunkOverlap: 200,
    topK: 5,
    embeddingProvider: "vertex",
    embeddingModel: "text-embedding-004",
  },
});
```

- **chunkSize**: The target size for each document chunk in characters. Larger chunks preserve more context but may dilute relevance for specific queries.
- **chunkOverlap**: The number of characters that overlap between adjacent chunks. This prevents important information from being split across chunk boundaries.
- **topK**: The maximum number of chunks to retrieve. More chunks provide more context but increase token usage and cost.
- **embeddingProvider / embeddingModel**: The provider and model used for both document and query embeddings. Configure them together when you need a specific embedding space.

## Vector Similarity Operations

Under the hood, NeuroLink's vector query tool performs similarity search against chunked document embeddings. Here is a conceptual breakdown of what happens during retrieval:

```typescript
// Conceptual example of similarity scoring
// NeuroLink handles this internally during RAG retrieval

// The RAG pipeline:
// 1. Chunks source documents
// 2. Embeds each chunk with the provider's embedding model
// 3. Embeds the user query
// 4. Computes similarity scores
// 5. Returns top-K most relevant chunks
// 6. Feeds chunks as context to the LLM
```

The inline `rag` option returns up to `topK` results and does not expose a `scoreThreshold` field. If your application requires threshold filtering, query the standalone `RAGPipeline` with `{ generate: false }` (or query a vector-store adapter directly), filter the returned scored sources in application code, and only then assemble context. Calibrate the cutoff against representative relevant and irrelevant queries; neither query path has a built-in threshold option.

### When Similarity Scores Mislead

Be aware that similarity scores are not absolute measures of relevance. A score of 0.85 from OpenAI's `text-embedding-3-small` does not mean the same thing as 0.85 from Google's `gemini-embedding-001`. The score distributions differ between models, so you need to calibrate your threshold for each model you use.

A practical approach is to embed a set of known-relevant and known-irrelevant queries against your document set, then choose a threshold that correctly separates the two groups.

## Choosing the Right Embedding Model

The choice of embedding model affects vector dimensions, accuracy, cost, and latency. Here is a comparison to guide your decision:

| Provider | Model | Best For |
|---|---|---|
| **OpenAI** | text-embedding-3-small | Cost-effective general use |
| **OpenAI** | text-embedding-3-large | Higher-capacity OpenAI embeddings |
| **Google AI** | gemini-embedding-001 | Google AI Studio integration |
| **Vertex AI** | text-embedding-004 | Vertex AI deployments |

**Key trade-offs:**

- **Vector size**: Larger vectors require more storage and similarity-computation work. Check the selected provider model's current output dimensions before sizing a persistent index.
- **Provider consistency**: Beyond using the same model for documents and queries, keep your entire pipeline on one provider. Switching embedding providers mid-project means re-embedding your entire document corpus.
- **Cost**: Embedding generation cost scales with input size. For large document sets, the cost difference between models can be significant.

## Best Practices

### Chunk Size Optimization

Chunk size is the single most impactful parameter in your RAG pipeline:

- **Too small** (under 200 characters): Chunks lose context. A question about "the CEO's strategy" might match a chunk containing just "the CEO said" without the actual strategy.
- **Too large** (over 2000 characters): Chunks contain multiple topics, diluting the relevance signal. The right answer is buried among irrelevant sentences.
- **Sweet spot** (500-1000 characters): Most use cases perform best in this range. Start at 500 and increase if you notice that answers lack context.

### Overlap Strategy

Overlap prevents important information from being split across chunk boundaries. A 10-20% overlap (50-200 characters for typical chunk sizes) is a good starting point. Increase overlap for documents where key information spans multiple paragraphs.

### Caching and Performance

For static documents that do not change frequently, cache the generated embeddings to avoid recomputation. Embedding generation has both a monetary cost (API calls) and a latency cost (network round trips). Caching eliminates both for previously processed documents.

### Hybrid Search

Pure vector search can miss results that match on exact terms rather than semantic meaning. For example, a query for "error code NL-4021" would not match well semantically because error codes are arbitrary identifiers. Hybrid search combines vector similarity with BM25 keyword matching to handle both semantic and lexical queries effectively.

### Circuit Breaker Protection

Monitor your embedding pipeline with the circuit breaker pattern. When a provider experiences an outage, the circuit breaker prevents your application from hammering a failing endpoint. The breaker opens after a configurable number of failures and periodically tests whether the provider has recovered.

## What's Next

You have completed all the steps in this guide. To continue building on what you have learned:

1. Review the code examples and adapt them for your specific use case
2. Start with the simplest pattern first and add complexity as your requirements grow
3. Monitor performance metrics to validate that each change improves your system
4. Consult the NeuroLink documentation for advanced configuration options

---

**Related posts:**

- [PowerPoint Generation with AI: From Text Prompt to Complete Presentation](/posts/powerpoint-generation-ai/)
- [Building a RAG Application with TypeScript: Complete Tutorial](/posts/rag-application-typescript-tutorial/)
- [Advanced RAG: 10 Chunking Strategies, Hybrid Search, and Reranking](/posts/advanced-rag/)
