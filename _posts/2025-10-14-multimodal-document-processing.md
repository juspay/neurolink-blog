---
layout: post
title: "Multimodal Document Processing with NeuroLink"
date: 2025-10-14 10:00:00 +0530
categories: [Tutorials, Features]
tags: [multimodal, pdf, csv, documents, processing]
author: neurolink
description: "Learn how to process PDFs, CSVs, images, and text files using NeuroLink's unified multimodal API."
image:
  path: /assets/img/posts/multimodal-document-processing/hero.png
  alt: Multimodal Document Processing Tutorial
toc: true
mermaid: true
pin: false
---

You will process PDFs, CSVs, images, and text files through a single TypeScript interface using NeuroLink's unified multimodal API. By the end of this tutorial, you will have auto-detection that identifies file types, smart routing that selects the right provider, and a production pipeline that handles any document your users upload.

Each document format requires different parsing: PDFs need visual analysis, CSVs need tabular understanding, images need vision capabilities. You will handle all of them through one code path instead of maintaining separate libraries for each format.

> **Note:** Currently supported file types are **PDF, CSV, images, and plain text**. Office document support (.xlsx, .docx, .pptx) is defined in the type system but not yet implemented.

```mermaid
flowchart LR
    subgraph Input["Your Documents"]
        PDF["PDF Files"]
        CSV["CSV Data"]
        IMG["Images"]
        TXT["Text Files"]
    end

    subgraph NL["NeuroLink SDK"]
        FD["FileDetector<br/>(Auto-detection)"]
        PR["Provider Router"]
    end

    subgraph Providers["AI Providers"]
        V["Vertex AI<br/>(PDF native)"]
        A["Anthropic<br/>(PDF native)"]
        O["OpenAI<br/>(PDF native)"]
    end

    subgraph Output["Results"]
        SUM["Summaries"]
        EXT["Extracted Data"]
        INS["Insights"]
    end

    PDF & CSV & IMG & TXT --> FD
    FD --> PR
    PR --> V & A & O
    V & A & O --> SUM & EXT & INS

    style FD fill:#6366f1,stroke:#4f46e5,color:#fff
    style PR fill:#10b981,stroke:#059669,color:#fff
```

---

## Why unified document processing matters

Traditional document AI requires juggling multiple tools:

| Document Type | Traditional Approach | Problems |
|--------------|---------------------|----------|
| PDF | pdf-parse + OCR + separate API | Loses visual context, slow |
| CSV | csv-parser + custom formatting | No semantic understanding |
| Excel | xlsx library + cell traversal | Complex, error-prone |
| Word | mammoth.js + text extraction | Loses formatting intent |
| PowerPoint | pptx2json + slide parsing | Misses visual relationships |

NeuroLink replaces this complexity with one API call:

```typescript
import { NeuroLink } from "@juspay/neurolink";

const ai = new NeuroLink();

// Process supported document types
const result = await ai.generate({
  input: {
    text: "Analyze this document and extract key insights",
    files: ["report.pdf", "data.csv"]
  }
});
```

The SDK handles everything:

- **Format Detection**: Magic bytes identify file type accurately
- **Provider Selection**: Routes PDFs to vision-capable providers
- **Text Optimization**: Formats tabular data for LLM consumption
- **Error Handling**: Graceful fallbacks for edge cases

---

## Document processing architecture

### FileDetector: Automatic Format Recognition

NeuroLink's FileDetector uses multiple strategies to identify files correctly:

```mermaid
flowchart TB
    FILE["Input File"] --> MAGIC["Magic Byte Check<br/>(PDF, Office signatures)"]
    MAGIC -->|"Identified"| RESULT["Format Confirmed"]
    MAGIC -->|"Unknown"| MIME["MIME Type Check"]
    MIME -->|"Identified"| RESULT
    MIME -->|"Unknown"| EXT["Extension Check"]
    EXT -->|"Identified"| RESULT
    EXT -->|"Unknown"| HEURISTIC["Content Heuristics"]
    HEURISTIC --> RESULT

    style FILE fill:#3b82f6,stroke:#2563eb,color:#fff
    style RESULT fill:#22c55e,stroke:#16a34a,color:#fff
    style MAGIC fill:#6366f1,stroke:#4f46e5,color:#fff
```

This multi-layer approach handles edge cases like:

- Renamed files (`.txt` containing CSV data)
- Missing extensions (cloud storage downloads)
- Corrupted headers (partial uploads)

### Processing Modes by Format

Different formats require different processing strategies:

| Format | Processing Mode | Provider Support | Best For |
|--------|----------------|------------------|----------|
| PDF | Native binary (visual) | Vertex AI, Anthropic, OpenAI, Google AI, Bedrock | Charts, tables, layouts |
| CSV | Text conversion (markdown) | All providers | Data analysis |
| Images | Native binary (visual) | Vision-capable providers | Screenshots, photos |
| Text | Direct text input | All providers | Plain text files |
| Excel* | Planned | - | Multi-sheet data |
| Word* | Planned | - | Contract analysis |
| PowerPoint* | Planned | - | Presentation summary |

*Office formats are defined in the type system but not yet implemented.

---

## Part 1: PDF Processing

PDFs are the workhorse of business documents. NeuroLink processes them natively, preserving visual context that OCR-based approaches lose.

### Why Native PDF Matters

Traditional PDF processing converts to text, destroying valuable information:

| Approach | Charts | Tables | Images | Layout |
|----------|--------|--------|--------|--------|
| OCR-based | Lost | Partial | Lost | Lost |
| Text extraction | Lost | Lost | Lost | Lost |
| **Native visual (NeuroLink)** | Preserved | Preserved | Analyzed | Understood |

Native processing sends the PDF directly to vision-capable models. The AI sees exactly what humans see.

### Basic PDF Analysis

```typescript
import { NeuroLink } from "@juspay/neurolink";

const ai = new NeuroLink();

// Analyze a PDF document
const result = await ai.generate({
  input: {
    text: "What is the total revenue mentioned in this financial report?",
    files: ["quarterly-report.pdf"]
  },
  provider: "vertex",  // PDF-capable provider
  model: 'gemini-2.0-flash-001',
  maxTokens: 1000
});

console.log(result.content);
// "The Q3 2025 report shows total revenue of $42.3 million,
//  a 15% increase from Q2's $36.8 million..."
```

> **Code Example:** See the [PDF Support documentation](https://docs.neurolink.ink/features/pdf-support/) for complete examples and patterns.

### Structured Data Extraction with Schema

Extract structured JSON from unstructured PDFs using schema enforcement:

```typescript
import { NeuroLink } from "@juspay/neurolink";
import { z } from "zod";

const ai = new NeuroLink();

// Define schema using Zod
const InvoiceSchema = z.object({
  vendor: z.string(),
  invoiceNumber: z.string(),
  date: z.string(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number()
  })),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number()
});

// Extract structured data from invoice
const invoice = await ai.generate({
  input: {
    text: "Extract invoice details in JSON format",
    files: ["invoice.pdf"]
  },
  provider: "anthropic",
  model: 'claude-sonnet-4-5-20250929',
  schema: InvoiceSchema,
  output: { format: "json" }
});

console.log(JSON.parse(invoice.content));
// { vendor: "Acme Corp", invoiceNumber: "INV-2025-001", ... }
```

Schema enforcement guarantees the output structure. No more parsing inconsistent responses.

### Multi-PDF Comparison

Compare multiple documents in a single request:

```typescript
const comparison = await ai.generate({
  input: {
    text: "Compare Q1 and Q2 reports. What changed in revenue and expenses?",
    files: ["q1-report.pdf", "q2-report.pdf"]
  },
  provider: "vertex",
  model: 'gemini-2.0-flash-001',
  maxTokens: 2000
});

console.log(comparison.content);
// "Comparing Q1 to Q2:
//  - Revenue increased 18% ($31.2M to $36.8M)
//  - Operating expenses decreased 5% due to..."
```

The model maintains context across documents, enabling meaningful comparisons.

### CLI PDF Commands

Process PDFs directly from the command line using the `--file` flag (auto-detects file type):

```bash
npx @juspay/neurolink generate "Summarize this contract" \
  --file contract.pdf \
  --provider vertex

# Multiple PDFs
npx @juspay/neurolink generate "Compare these invoices" \
  --file invoice1.pdf \
  --file invoice2.pdf \
  --provider anthropic

# Stream PDF analysis (for long documents)
npx @juspay/neurolink stream "Explain this document in detail" \
  --file technical-spec.pdf \
  --provider bedrock
```

---

## Part 2: CSV Data Analysis

CSV files contain the data that drives decisions. NeuroLink transforms raw data into actionable insights.

### How CSV Processing Works

```mermaid
flowchart LR
    CSV["CSV File"] --> PARSE["Stream Parser<br/>(Memory efficient)"]
    PARSE --> FORMAT["LLM Formatter<br/>(Markdown/JSON)"]
    FORMAT --> PROMPT["Combined with<br/>User Query"]
    PROMPT --> LLM["AI Provider"]
    LLM --> INSIGHT["Data Insights"]

    style CSV fill:#3b82f6,stroke:#2563eb,color:#fff
    style FORMAT fill:#6366f1,stroke:#4f46e5,color:#fff
    style INSIGHT fill:#22c55e,stroke:#16a34a,color:#fff
```

The process:

1. **Streaming parser** handles large files without memory issues
2. **LLM-optimized formatting** presents data as markdown tables or JSON
3. **Works with ALL providers** (not just vision-capable ones)
4. **Auto-detects** delimiters, encodings, and headers

### Basic CSV Analysis

```typescript
import { NeuroLink } from "@juspay/neurolink";

const ai = new NeuroLink();

// Analyze CSV data
const insights = await ai.generate({
  input: {
    text: "What are the key trends in this sales data? Identify top performers.",
    files: ["sales-2024.csv"]
  }
});

console.log(insights.content);
// "Key trends from your sales data:
//  1. Q4 showed strongest growth at 23% MoM
//  2. Top performer: Sarah Chen ($2.3M total)
//  3. Product category 'Enterprise' leads at 45% of revenue..."
```

> **Code Example:** See the [CSV Support documentation](https://docs.neurolink.ink/features/csv-support/) for more patterns.

### Advanced CSV Options

Control how CSV data is processed:

```typescript
const analysis = await ai.generate({
  input: {
    text: "Identify the top 10 customers by total revenue",
    files: ["customers.csv"]
  },
  csvOptions: {
    maxRows: 1000,            // Limit rows (1-10000)
    formatStyle: "markdown",  // "raw" | "markdown" | "json"
    includeHeaders: true      // Include header row
  }
});
```

For large files, `maxRows` prevents token overflow while maintaining representativeness.

### Combining CSV with PDF

Cross-reference data across formats:

```typescript
// Verify spreadsheet data against report
const verification = await ai.generate({
  input: {
    text: "Does the transaction data in the CSV match the totals in the PDF report?",
    files: [
      "transactions.csv",    // Auto-detected as CSV
      "monthly-report.pdf"   // Auto-detected as PDF
    ]
  },
  provider: "vertex",  // Supports both formats
  model: 'gemini-2.0-flash-001',
});
```

NeuroLink's auto-detection handles mixed formats seamlessly.

### CLI CSV Commands

Use the `--file` flag which auto-detects CSV format:

```bash
# Analyze CSV data
npx @juspay/neurolink generate "Find trends in this data" --file sales.csv

# Multiple CSVs
npx @juspay/neurolink generate "Compare datasets" --file q1.csv --file q2.csv
```

---

## Part 3: Office Documents (Future Support)

> **Important:** Office document processing (.xlsx, .docx, .pptx) is defined in the SDK's type system but **not yet implemented**. The file type definitions exist for forward compatibility, but attempting to process these formats will result in an error. Currently supported file types are: **PDF, CSV, images, and plain text**.
>
> This section describes the planned API design. Check the [NeuroLink changelog](https://github.com/juspay/neurolink/releases) for implementation updates.

When Office document support is implemented, you will be able to process Excel, Word, and PowerPoint files using the same unified API pattern shown above for PDFs and CSVs

---

## Part 4: Production Patterns

Real-world document processing requires robust patterns for scale and reliability.

### Document Processing Pipeline

```typescript
import { NeuroLink } from "@juspay/neurolink";
import fs from "fs";
import path from "path";

interface ProcessingResult {
  file: string;
  summary: string;
  success: boolean;
  error?: string;
}

class DocumentPipeline {
  private ai: NeuroLink;

  constructor() {
    this.ai = new NeuroLink({
      conversationMemory: { enabled: true }
    });
  }

  async processDirectory(dirPath: string): Promise<ProcessingResult[]> {
    const files = fs.readdirSync(dirPath);
    const results: ProcessingResult[] = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const ext = path.extname(file).toLowerCase();

      // Select appropriate provider based on file type
      const provider = this.selectProvider(ext);

      try {
        const result = await this.ai.generate({
          input: {
            text: "Extract key information and create a summary",
            files: [filePath]
          },
          provider
        });

        results.push({
          file,
          summary: result.content,
          success: true
        });
      } catch (error: any) {
        results.push({
          file,
          summary: "",
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  private selectProvider(ext: string): string {
    // PDF needs vision-capable provider
    if (ext === ".pdf") return "vertex";
    // Others work with any provider
    return "openai";
  }
}
```

> **Code Example:** See the [Advanced Examples documentation](https://docs.neurolink.ink/examples/advanced/) for the complete pipeline implementation.

### Error Handling Best Practices

Production document processing encounters various error conditions. A robust error handling strategy anticipates these failures and recovers gracefully. Here is a comprehensive approach:

```typescript
import { NeuroLink } from "@juspay/neurolink";

const ai = new NeuroLink();

async function processDocumentSafely(filePath: string, query: string) {
  try {
    const result = await ai.generate({
      input: {
        text: query,
        files: [filePath]
      },
      provider: "vertex",
      model: 'gemini-2.0-flash-001',
    });

    return { success: true, content: result.content };
  } catch (error: any) {
    // Check error message for specific conditions
    const errorMessage = error.message?.toLowerCase() || "";

    if (errorMessage.includes("too large") || errorMessage.includes("page limit")) {
      // PDF exceeds provider page limit (100 pages for most providers)
      // Strategy: Split document into chunks
      console.log(`Document ${filePath} exceeds page limit`);
      return await processLargeDocument(filePath, query);
    }

    if (errorMessage.includes("unsupported") || errorMessage.includes("format")) {
      // File type not recognized or supported
      // Strategy: Convert to supported format or log for manual review
      console.log(`Unsupported format: ${filePath}`);
      return { success: false, error: "Format not supported", requiresManualReview: true };
    }

    if (errorMessage.includes("not found") || errorMessage.includes("enoent")) {
      // File path invalid or file deleted
      console.log(`File not found: ${filePath}`);
      return { success: false, error: "File not found" };
    }

    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      // Provider rate limit hit
      // Strategy: Exponential backoff retry
      console.log("Rate limited, retrying with backoff");
      return await retryWithBackoff(() => processDocumentSafely(filePath, query));
    }

    if (errorMessage.includes("context") || errorMessage.includes("token limit")) {
      // Document content exceeds model context window
      // Strategy: Summarize in chunks or use larger context model
      console.log("Context length exceeded, chunking document");
      return await processInChunks(filePath, query);
    }

    if (errorMessage.includes("auth") || errorMessage.includes("credential") || errorMessage.includes("401")) {
      // Invalid or expired API credentials
      console.error("Authentication failed - check provider credentials");
      throw error; // Cannot recover, must fix credentials
    }

    if (errorMessage.includes("network") || errorMessage.includes("econnrefused") || errorMessage.includes("timeout")) {
      // Transient network failure
      console.log("Network error, scheduling retry");
      return await retryWithBackoff(() => processDocumentSafely(filePath, query), 3);
    }

    // Try fallback provider for other errors
    console.log("Attempting fallback to alternative provider");
    return await processWithFallbackProvider(filePath, query);
  }
}

// Helper: Process large documents by splitting
async function processLargeDocument(filePath: string, query: string) {
  // Implementation depends on document type
  // For PDFs: Extract page ranges and process separately
  // For CSVs: Process in row batches
  console.log("Splitting document for processing...");
  // ... implementation
  return { success: true, content: "Aggregated results", chunked: true };
}

// Helper: Process documents in chunks for context window limits
async function processInChunks(filePath: string, query: string) {
  // Split query or document content into manageable chunks
  // Process each chunk separately and combine results
  console.log("Processing in chunks due to context limits...");
  // ... implementation
  return { success: true, content: "Chunked results combined", chunked: true };
}

// Helper: Fallback to different provider
async function processWithFallbackProvider(filePath: string, query: string) {
  const fallbackProviders = ["vertex", "anthropic", "bedrock"];

  for (const provider of fallbackProviders) {
    try {
      const result = await ai.generate({
        input: { text: query, files: [filePath] },
        provider
      });
      return { success: true, content: result.content, provider };
    } catch (e) {
      continue; // Try next provider
    }
  }

  return { success: false, error: "All providers failed" };
}

// Helper: Exponential backoff retry
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}
```

This error handling pattern covers the most common failure modes in production document processing. The key principles are: fail fast on unrecoverable errors, retry transient failures, and provide graceful degradation for capability mismatches.

### File Validation Before Processing

Validate files before sending to the API to catch problems early:

```typescript
import fs from "fs";
import path from "path";

interface ValidationResult {
  valid: boolean;
  error?: string;
  fileInfo?: {
    size: number;
    extension: string;
    estimatedPages?: number;
  };
}

function validateDocument(filePath: string): ValidationResult {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: "File not found" };
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Check file size (50MB limit for most providers)
  const maxSize = 50 * 1024 * 1024;
  if (stats.size > maxSize) {
    return { valid: false, error: `File exceeds ${maxSize / 1024 / 1024}MB limit` };
  }

  // Check empty files
  if (stats.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  // Validate supported extensions (currently implemented)
  const supportedExtensions = [".pdf", ".csv", ".txt", ".png", ".jpg", ".jpeg", ".gif", ".webp"];
  if (!supportedExtensions.includes(ext)) {
    return { valid: false, error: `Unsupported extension: ${ext}` };
  }

  // Estimate PDF pages (rough calculation: ~100KB per page average)
  const estimatedPages = ext === ".pdf" ? Math.ceil(stats.size / 100000) : undefined;

  return {
    valid: true,
    fileInfo: {
      size: stats.size,
      extension: ext,
      estimatedPages
    }
  };
}
```

### Streaming for Long Document Analysis

When processing lengthy documents, streaming provides real-time feedback and prevents timeout issues:

```typescript
import { NeuroLink } from "@juspay/neurolink";

const ai = new NeuroLink();

async function analyzeWithStreaming(filePath: string) {
  console.log("Starting document analysis...\n");

  const result = await ai.stream({
    input: {
      text: "Provide a comprehensive analysis of this document including key themes, important data points, and actionable recommendations",
      files: [filePath]
    },
    provider: "vertex",
    maxTokens: 4000
  });

  let fullResponse = "";

  for await (const chunk of result.stream) {
    // Text chunks have content property (no type field)
    // Audio chunks have { type: "audio", audio: AudioChunk }
    if ("content" in chunk && typeof chunk.content === "string") {
      process.stdout.write(chunk.content);
      fullResponse += chunk.content;
    }
  }

  // Usage is available after stream completes
  if (result.usage) {
    console.log(`\n[Total tokens: ${result.usage.total}]`);
  }

  return fullResponse;
}
```

Streaming is particularly valuable for:

- **User experience**: Display results as they generate rather than waiting for completion
- **Timeout prevention**: Long-running analysis stays active with continuous data flow
- **Progress indication**: Users see immediate feedback that processing is occurring
- **Memory efficiency**: Process chunks instead of buffering entire responses

### Batch Processing with Rate Limiting

Process multiple documents while respecting API limits:

```typescript
async function batchProcess(files: string[]) {
  const ai = new NeuroLink();
  const results = [];

  // Process in batches of 2 to respect rate limits
  const batchSize = 2;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (file) => {
        try {
          const result = await ai.generate({
            input: {
              text: "Summarize this document",
              files: [file]
            },
            provider: "vertex",
            model: 'gemini-2.0-flash-001',
          });
          return { file, success: true, content: result.content };
        } catch (error: any) {
          return { file, success: false, error: error.message };
        }
      })
    );

    results.push(...batchResults);

    // Add delay between batches
    if (i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
```

---

## Provider comparison for Documents

Not all providers handle documents equally:

| Provider | Native PDF | Max Size | Max Pages | CSV | Excel* | Word* |
|----------|------------|----------|-----------|-----|--------|-------|
| vertex | Yes | 5 MB | 100 | Yes | Planned | Planned |
| Anthropic | Yes | 5 MB | 100 | Yes | Planned | Planned |
| google-ai | Yes | 2 GB | 100 | Yes | Planned | Planned |
| OpenAI | Yes | 10 MB | 100 | Yes | Planned | Planned |
| Bedrock | Yes | 5 MB | 100 | Yes | Planned | Planned |
| LiteLLM | Yes | 10 MB | 100 | Yes | Planned | Planned |
| Azure OpenAI | Yes (via Files API) | 10 MB | 100 | Yes | Planned | Planned |
| Mistral | No | - | - | Yes | Planned | Planned |
| Ollama | No | - | - | Yes | Planned | Planned |

*Excel and Word support is defined in the type system but not yet implemented. Mistral and Ollama do not currently support PDF input.

> **Note:** LiteLLM limits depend on upstream model configuration.
>
> **Note:** Pricing changes frequently. Check provider documentation for current rates.

**Recommendation:** Use Vertex AI or Anthropic for PDF-heavy workloads with native support. Fall back to Anthropic for its reasoning quality on complex documents.

---

## Performance optimization

Optimizing document processing involves balancing speed, cost, and quality. These patterns help you achieve production-grade performance.

### Memory Management for Large Files

Large documents can exhaust memory if not handled carefully. Configure processing options at the `generate()` call level:

```typescript
const ai = new NeuroLink({
  conversationMemory: { enabled: true }
});

// CSV options are passed in the generate() call, not constructor
const result = await ai.generate({
  input: {
    text: "Analyze this data",
    files: ["large-data.csv"]
  },
  csvOptions: {
    maxRows: 500,           // Limit rows (1-10000)
    formatStyle: "markdown" // "raw" | "markdown" | "json"
  }
});
```

For very large files, process in segments:

```typescript
async function processLargePDF(filePath: string) {
  const ai = new NeuroLink();

  // For large PDFs, instruct the model via the text prompt
  // PDF processing is automatic - no pdfOptions needed
  const result = await ai.generate({
    input: {
      text: `Analyze this document comprehensively. Focus on:
        1. Executive summary of key points
        2. Important data and figures
        3. Main conclusions and recommendations

        If the document is very long, prioritize the most important sections.`,
      files: [filePath]
    },
    provider: "vertex",  // Native PDF support with 100 page limit
    model: 'gemini-2.0-flash-001',
    maxTokens: 4000
  });

  return result.content;
}

// For documents exceeding provider page limits, split the PDF externally
// and process each part separately, then combine results
async function processMultiPartPDF(pdfParts: string[]) {
  const ai = new NeuroLink();
  const summaries: string[] = [];

  for (const partPath of pdfParts) {
    const result = await ai.generate({
      input: {
        text: "Summarize the key points from this document section",
        files: [partPath]
      },
      provider: "vertex",
      model: 'gemini-2.0-flash-001',
    });
    summaries.push(result.content);
  }

  // Combine segment summaries into final summary
  const combinedSummaries = summaries.join("\n\n---\n\n");
  const finalResult = await ai.generate({
    input: {
      text: `Combine these section summaries into a cohesive document summary:\n\n${combinedSummaries}`
    }
  });

  return finalResult.content;
}
```

### Caching Repeated Analysis

Avoid reprocessing identical documents by implementing a cache layer:

```typescript
import { createHash } from "crypto";
import fs from "fs";

interface CacheEntry {
  content: string;
  timestamp: number;
  fileHash: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 3600000; // 1 hour

async function analyzeWithCache(filePath: string, query: string) {
  // Create cache key from file content hash + query
  const fileBuffer = fs.readFileSync(filePath);
  const fileHash = createHash("md5").update(fileBuffer).digest("hex");
  const cacheKey = createHash("md5")
    .update(fileHash + query)
    .digest("hex");

  // Check cache validity
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("Cache hit - returning cached result");
    return cached.content;
  }

  // Process and cache
  const result = await ai.generate({
    input: { text: query, files: [filePath] }
  });

  cache.set(cacheKey, {
    content: result.content,
    timestamp: Date.now(),
    fileHash
  });

  return result.content;
}
```

For production systems, replace the in-memory Map with Redis or another distributed cache.

### Provider Selection for Cost Optimization

Different providers have different cost structures. Select based on your needs:

```typescript
function selectOptimalProvider(fileType: string, priority: "speed" | "cost" | "quality") {
  const providerMatrix = {
    pdf: {
      speed: "vertex",      // Fastest for PDFs
      cost: "vertex",       // $0.00125 per 1K tokens
      quality: "anthropic"  // Best reasoning
    },
    csv: {
      speed: "openai",      // Fast text processing
      cost: "openai",       // Competitive pricing
      quality: "anthropic"  // Best analysis
    },
    default: {
      speed: "openai",
      cost: "vertex",
      quality: "anthropic"
    }
  };

  const providers = providerMatrix[fileType as keyof typeof providerMatrix] || providerMatrix.default;
  return providers[priority];
}

// Usage
const provider = selectOptimalProvider(".pdf", "cost");
const result = await ai.generate({
  input: { text: query, files: [filePath] },
  provider
});
```

### Parallel Processing for Multiple Documents

When processing many documents, parallelize within rate limits:

```typescript
import pLimit from "p-limit";

async function processDocumentsParallel(files: string[], concurrency: number = 3) {
  const ai = new NeuroLink();
  const limit = pLimit(concurrency);

  const tasks = files.map(file =>
    limit(async () => {
      const result = await ai.generate({
        input: {
          text: "Extract key information from this document",
          files: [file]
        }
      });
      return { file, content: result.content };
    })
  );

  return Promise.all(tasks);
}

// Process 10 files with max 3 concurrent requests
const results = await processDocumentsParallel(documentList, 3);
```

### Token Usage Optimization

Reduce costs by optimizing token consumption:

```typescript
// 1. Use concise prompts
const efficientPrompt = "List: vendor, amount, date, items"; // Fewer tokens
const verbosePrompt = "Please extract the vendor name, total amount, invoice date, and line items"; // More tokens

// 2. Limit output tokens appropriately
const result = await ai.generate({
  input: { text: efficientPrompt, files: [invoice] },
  maxTokens: 500  // Sufficient for structured extraction
});

// 3. Use schema to constrain output
const structured = await ai.generate({
  input: { text: "Extract invoice data", files: [invoice] },
  schema: invoiceSchema,
  output: { format: "json" }  // JSON is typically more token-efficient
});
```

---

## Next steps

You now have everything needed to process any business document with AI. Here's where to go next:

### Expand Your Capabilities

- **[OpenRouter Integration Guide]({% post_url 2025-12-30-openrouter-integration-guide %})** - Access 500+ models through a single API
- **[Enterprise HITL & Guardrails Guide](https://docs.neurolink.ink/features/hitl/)** - Add human review for high-stakes documents
- **[Conversation Memory Configuration](https://docs.neurolink.ink/conversation-memory/)** - Remember context across document sessions

### Reference Documentation

- **[Full SDK API Reference](https://docs.neurolink.ink/sdk/api-reference/)** - Complete TypeScript API documentation
- **[Provider Configuration Options](https://docs.neurolink.ink/getting-started/provider-setup/)** - Detailed setup for all 13 supported providers
- **[CLI Command Reference](https://docs.neurolink.ink/cli/commands/)** - Every CLI command with examples

### Get Started Now

Install NeuroLink and start processing documents:

```bash
# One command to get started
pnpm dlx @juspay/neurolink setup
```

The setup wizard guides you through configuration. You'll analyze your first PDF in under five minutes.

---

## What you built

You built a complete document processing pipeline: PDF analysis with native vision, CSV data extraction with streaming parsers, production error handling with provider fallback, and cost optimization through intelligent provider selection. Every document type flows through a single API with auto-detection and smart routing.

Continue with these related tutorials:

- Processing Any Document: 50+ File Types for the full `ProcessorRegistry` architecture
- [Enterprise HITL and Guardrails Guide](https://docs.neurolink.ink/features/hitl/) for adding human review to high-stakes documents
- OpenRouter Integration Guide for accessing 500+ models through a single API

```mermaid
flowchart LR
    subgraph Docs["Your Documents"]
        D1["PDFs"]
        D2["CSVs"]
        D3["Images"]
        D4["Text"]
    end

    subgraph NL["NeuroLink"]
        API["Unified API"]
    end

    subgraph Out["Intelligence"]
        I1["Summaries"]
        I2["Extracted Data"]
        I3["Insights"]
        I4["Comparisons"]
    end

    D1 & D2 & D3 & D4 --> API
    API --> I1 & I2 & I3 & I4

    style API fill:#6366f1,stroke:#4f46e5,color:#fff
    style I1 fill:#22c55e,stroke:#16a34a,color:#fff
```

**One API. Supported Documents. Real Intelligence.**

---

**Related posts:**

- [Building RAG Applications with NeuroLink SDK](/posts/rag-implementation/)
- [Real-Time AI: Streaming Response Patterns with NeuroLink](/posts/streaming-best-practices/)
- [LLM Cost Optimization: Practical Strategies to Reduce Your AI Spend](/posts/cost-optimization-strategies/)
