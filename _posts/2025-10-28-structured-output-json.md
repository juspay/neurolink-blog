---
layout: post
title: 'Structured Output: JSON Schema Enforcement with NeuroLink'
date: '2025-10-28 10:00:00 +0530'
categories:
  - Tutorial
  - Patterns
tags:
  - json
  - schema
  - structured-output
  - validation
  - typescript
author: neurolink
description: >-
  Get consistent JSON output from LLMs. Schema validation, type safety, and
  parsing patterns.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/structured-output-json/hero.png
  alt: 'Structured Output: JSON Schema Enforcement with NeuroLink'
---

> **Note:** This guide covers structured output features available in the current NeuroLink SDK. See our changelog for version-specific details.
{: .prompt-info }

You will request structured JSON output using NeuroLink's Zod schema support. By the end of this tutorial, you will have provider-aware generation that exposes parsed data through `result.structuredData`, plus application-level validation for a typed result -- no regex parsing or markdown unwrapping.

Ask an LLM for JSON without a schema and you might get valid JSON, markdown-wrapped JSON, JSON with trailing commas, or a conversational explanation. A schema lets NeuroLink use native constraints where the provider supports them and JSON coercion as a fallback on other paths.

Next, you will define Zod schemas for LLM output, integrate schema validation with NeuroLink's `generate()` call, and build error handling patterns for edge cases.

```mermaid
flowchart LR
    A[User Prompt] --> B[NeuroLink SDK]
    B --> C{Zod Schema}
    C --> D[Native Constraint or Coercion]
    D --> E[JSON Output]
    E --> F{Parse & Validate}
    F -->|Valid| G[Typed Data Object]
    F -->|Invalid| H[Retry with Backoff]
    H --> D
```

## The Problem with Unstructured LLM Output

Before diving into solutions, let us understand why structured output matters. Consider a simple use case: extracting contact information from unstructured text.

```typescript
const prompt = `Extract the contact info from this text and return JSON:
"Hi, I'm Sarah Chen. You can reach me at sarah.chen@techcorp.io or call 555-0123."`;

// Without structured output, you might get:
// Response 1: {"name": "Sarah Chen", "email": "sarah.chen@techcorp.io", "phone": "555-0123"}
// Response 2: ```json\n{"name": "Sarah Chen"...}\n```
// Response 3: Here's the extracted information: {"name": ...}
// Response 4: {"Name": "Sarah Chen", "Email": ...}  // Different casing
```

Each response requires different parsing logic. Multiply this by dozens of prompts across your application, and you have a maintenance nightmare. Worse, these variations often appear randomly, making bugs intermittent and hard to reproduce.

## Zod Schema Fundamentals

NeuroLink uses Zod schemas directly for structured output, providing excellent TypeScript integration and type inference. Zod schemas describe the shape of valid data while automatically providing TypeScript types.

### Basic Zod Schema Structure

A Zod schema document describes the shape of valid data:

```typescript
import { z } from 'zod';

const ContactSchema = z.object({
  name: z.string().describe('Full name of the contact'),
  email: z.string().email().describe('Valid email address'),
  phone: z.string().regex(/^[0-9]{3}-[0-9]{4}$/).optional()
});

// TypeScript type is automatically inferred
type Contact = z.infer<typeof ContactSchema>;
// { name: string; email: string; phone?: string }
```

This schema specifies that valid documents must be objects with a required `name` (string) and `email` (valid email format), plus an optional `phone` matching a specific pattern.

### Common Zod Schema Patterns

Understanding key Zod methods helps you define precise constraints:

**Type Methods:**

- `z.string()`, `z.number()`, `z.boolean()`: Primitive types
- `z.array(schema)`: Array of items matching schema
- `z.object({})`: Object with specified properties
- `z.enum(['a', 'b'])`: Restricts values to specific set
- `z.literal('value')`: Requires exact value

**String Refinements:**

- `.min(n)` / `.max(n)`: Length constraints
- `.regex(pattern)`: Regular expression validation
- `.email()`, `.url()`, `.uuid()`: Built-in format validators

**Number Refinements:**

- `.min(n)` / `.max(n)`: Value bounds
- `.int()`: Integer validation
- `.positive()`, `.negative()`: Sign constraints

**Array Methods:**

- `.min(n)` / `.max(n)`: Length constraints
- `.nonempty()`: Require at least one element

**Object Methods:**

- `.partial()`: Make all properties optional
- `.required()`: Make all properties required
- `.extend({})`: Add additional properties

## NeuroLink Schema Enforcement

NeuroLink accepts a Zod schema directly in both `generate()` and `stream()`. It uses provider-native structured output when available and falls back to schema-guided JSON coercion when native schema enforcement cannot be combined with the selected provider or tools.

> **Tip:** Passing `schema` is sufficient to request structured output. `output.format: 'json'` is optional when a schema is present; use it when you want JSON output without supplying a schema.
{: .prompt-tip }

### Basic Usage

Define your Zod schema and pass it to the generate method:

```typescript
import { z } from 'zod';
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const ContactSchema = z.object({
  name: z.string().describe('Full name'),
  email: z.string().email().describe('Email address'),
  phone: z.string().optional(),
  company: z.string().optional()
});

const result = await neurolink.generate({
  input: {
    text: 'Extract contact: "John Smith, john@acme.com, works at Acme Inc"'
  },
  schema: ContactSchema
});

// Prefer the parsed object NeuroLink returns for schema requests.
const contact = ContactSchema.parse(result.structuredData);
// { name: "John Smith", email: "john@acme.com", company: "Acme Inc" }
```

NeuroLink converts your Zod schema to the appropriate format for each provider and exposes a recovered, schema-compatible value as `result.structuredData` when the model produces one. On that successful path, `result.content` is its JSON string representation. A pure-prose or unrecoverable response can leave `structuredData` undefined, which is why the example validates it with the same schema.

### Gemini Tools and Schemas

Gemini models cannot combine native function calling with native JSON-schema response enforcement. NeuroLink handles this conflict automatically: for a Gemini model it drops the tools for that request and keeps native JSON-schema enforcement, so you still get a schema-constrained response. Set `disableTools: true` only when you explicitly want a tool-free request.

> **Note:** This limitation applies to Gemini models on Google AI Studio and Vertex AI. Vertex-hosted Claude models use a different transport and can combine tools with schemas.
{: .prompt-info }

```typescript
import { z } from 'zod';
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const AnalysisSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  topics: z.array(z.string())
});

// Gemini schema request: NeuroLink selects the compatible path automatically.
const result = await neurolink.generate({
  input: { text: 'Analyze: "The product exceeded expectations!"' },
  schema: AnalysisSchema,
  provider: 'google-ai'
});

// Optional: force a tool-free call.
const toolFreeResult = await neurolink.generate({
  input: { text: 'Analyze: "The product exceeded expectations!"' },
  schema: AnalysisSchema,
  provider: 'google-ai',
  disableTools: true
});
```

On successful structured generation, both calls return JSON in `content` and a parsed value in `structuredData`; the second call additionally makes no tools available to that request. Validate `structuredData` before using it because an unrecoverable model response can leave the field undefined.

### Nested Objects and Arrays

Real-world data often involves nested structures. You can pass nested Zod objects and arrays directly:

```typescript
import { z } from 'zod';
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string()
});

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  total: z.number()
});

const InvoiceSchema = z.object({
  invoiceNumber: z.string(),
  date: z.string().describe('ISO date format'),
  customer: z.object({
    name: z.string(),
    address: AddressSchema.optional()
  }),
  lineItems: z.array(LineItemSchema).min(1),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number()
});

const result = await neurolink.generate({
  input: {
    text: `Parse this invoice:
      Invoice #INV-2024-001
      Date: 2024-01-15
      Customer: Acme Corp, 123 Main St, New York, NY 10001
      Items:
      - Widget A x 5 @ $10 = $50
      - Widget B x 3 @ $25 = $75
      Subtotal: $125, Tax: $12.50, Total: $137.50`
  },
  schema: InvoiceSchema,
  provider: 'openai',
});

const invoice = InvoiceSchema.parse(result.structuredData);
```

## Type-Safe Extraction Patterns

Build reusable utilities for type-safe extractions:

```typescript
import { z, ZodSchema } from 'zod';
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function extract<T extends ZodSchema>(
  schema: T,
  prompt: string,
  options?: {
    provider?: string;
    temperature?: number;
    disableTools?: boolean;
  }
): Promise<z.infer<T>> {
  const result = await neurolink.generate({
    input: { text: prompt },
    schema,
    provider: options?.provider,
    temperature: options?.temperature ?? 0,
    disableTools: options?.disableTools
  });

  return schema.parse(result.structuredData); // Validate and get typed result
}

// Usage with automatic type inference
const EventSchema = z.object({
  title: z.string(),
  date: z.string(),
  location: z.string(),
  attendees: z.array(z.string())
});

const event = await extract(
  EventSchema,
  'Parse: "Team meeting on Jan 15th at HQ with Alice, Bob, and Carol"'
);
// event is fully typed as { title: string; date: string; location: string; attendees: string[] }
```

### Provider-Selectable Extraction Helper

> **Note**: The `smartExtract()` function shown below is a custom helper pattern, not a built-in NeuroLink API method.
{: .prompt-info }

Create a reusable helper that lets callers select a provider and model. NeuroLink handles provider-specific structured-output behavior internally:

```typescript
import { z, ZodSchema } from 'zod';
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function smartExtract<T extends ZodSchema>(
  schema: T,
  prompt: string,
  options?: {
    provider?: string;
    model?: string;
    temperature?: number;
  }
): Promise<z.infer<T>> {
  const result = await neurolink.generate({
    input: { text: prompt },
    schema,
    provider: options?.provider ?? 'openai',
    model: options?.model,
    temperature: options?.temperature ?? 0
  });

  return schema.parse(result.structuredData);
}

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  occupation: z.string()
});

const geminiResult = await smartExtract(
  PersonSchema,
  'Extract: "John is a 30-year-old engineer"',
  { provider: 'google-ai' },
);

const openaiResult = await smartExtract(
  PersonSchema,
  'Extract: "John is a 30-year-old engineer"',
  { provider: 'openai' },
);
```

## Error Handling Patterns

Even with schema enforcement, robust error handling remains essential. Network issues, rate limits, and edge cases require thoughtful handling.

### Basic Error Handling

```typescript
import { z, ZodError } from 'zod';
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function safeExtract<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  provider: string = 'openai'
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const result = await neurolink.generate({
      input: { text: prompt },
      schema,
      provider
    });

    const data = schema.parse(result.structuredData);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: `Validation failed: ${error.message}` };
    }
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return { success: false, error: 'Rate limit exceeded. Please retry later.' };
      }
      return { success: false, error: `API error: ${error.message}` };
    }
    return { success: false, error: 'Unknown error occurred' };
  }
}

// Usage
const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  inStock: z.boolean()
});

const result = await safeExtract(
  ProductSchema,
  'Parse: "iPhone 15 Pro at $999, currently available"'
);

if (result.success) {
  console.log('Product:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### Retry Logic with Exponential Backoff

```typescript
import { z, ZodSchema, ZodError } from 'zod';
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function extractWithRetry<T extends ZodSchema>(
  schema: T,
  prompt: string,
  options?: {
    maxRetries?: number;
    provider?: string;
  }
): Promise<z.infer<T>> {
  const maxRetries = options?.maxRetries ?? 3;
  const provider = options?.provider ?? 'openai';
  let lastError: Error = new Error('Extraction failed');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await neurolink.generate({
        input: { text: prompt },
        schema,
        provider
      });

      return schema.parse(result.structuredData);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw error; // A schema mismatch is not a transient transport failure.
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxRetries) {
        break;
      }

      // In production, classify retryable provider/network errors by typed
      // status or error code rather than message text.
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

## Best Practices

### Schema Design

1. **Be specific with descriptions**: Add `.describe()` calls to help the model understand intent
2. **Use appropriate constraints**: Set `.min()`, `.max()`, where sensible
3. **Prefer enums over free text**: `z.enum(['a', 'b'])` reduces ambiguity
4. **Make fields optional when appropriate**: Use `.optional()` to allow the model to indicate missing data

```typescript
// Good schema design
const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).describe('Star rating from 1 to 5'),
  sentiment: z.enum(['positive', 'negative', 'neutral']).describe('Overall sentiment'),
  summary: z.string().max(200).describe('Brief summary under 200 characters'),
  pros: z.array(z.string()).max(5).describe('List of positive points'),
  cons: z.array(z.string()).max(5).describe('List of negative points'),
  recommendedFor: z.string().optional().describe('Who might benefit, if applicable')
});
```

### Prompt Engineering for Structured Output

1. **Provide context**: Explain what the data will be used for
2. **Give examples**: Show sample inputs and expected outputs
3. **Handle ambiguity**: Tell the model how to handle unclear cases
4. **Set expectations**: Specify formats for dates, numbers, and other formatted data

```typescript
import { z } from 'zod';
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

const DateEventSchema = z.object({
  title: z.string(),
  startDate: z.string().describe('ISO 8601 format: YYYY-MM-DD'),
  endDate: z.string().optional().describe('ISO 8601 format; omit if same as start'),
  isRecurring: z.boolean()
});

const result = await neurolink.generate({
  input: {
    text: `Extract event details from: "Weekly team standup every Monday at 9am starting Jan 15, 2024"

    Instructions:
    - Use ISO 8601 date format (YYYY-MM-DD)
    - For recurring events, use the first occurrence as startDate
    - Leave endDate empty if it's a single day event`
  },
  schema: DateEventSchema,
  output: { format: 'json' },
  temperature: 0
});
```

### Testing Strategies

1. **Unit test schemas**: Validate that schemas accept expected data and reject invalid data
2. **Integration test extractions**: Test with real-world examples
3. **Snapshot testing**: Capture extraction results for regression testing

```typescript
import { z } from 'zod';
import { describe, it, expect } from 'vitest';

const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional()
});

describe('ContactSchema', () => {
  it('accepts valid contact', () => {
    const valid = { name: 'John', email: 'john@example.com' };
    expect(() => ContactSchema.parse(valid)).not.toThrow();
  });

  it('rejects missing email', () => {
    const invalid = { name: 'John' };
    expect(() => ContactSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid email format', () => {
    const invalid = { name: 'John', email: 'not-an-email' };
    expect(() => ContactSchema.parse(invalid)).toThrow();
  });
});
```

## What You Built

You built structured JSON extraction with Zod schemas, provider-selectable helpers, retry logic with exponential backoff, and application-level validation. NeuroLink supplies JSON in `content` and a parsed value in `structuredData`; validating that value with the same Zod schema gives your application a typed result.

Continue with these related tutorials:

- Structured Output in TypeScript for provider-specific behavior and complex nested schemas
- [Building a RAG Application](/posts/rag-application-typescript-tutorial/) for combining structured output with retrieval
- [MCP Server Tutorial](/posts/mcp-server-tutorial/) for validating tool responses with Zod schemas

---

**Related posts:**

- [Error Handling Patterns for AI Applications](/posts/error-handling-patterns/)
- [Building a RAG Application with TypeScript: Complete Tutorial](/posts/rag-application-typescript-tutorial/)
- [MCP Server Tutorial: Build Your Own AI Tools in 30 Minutes](/posts/mcp-server-tutorial/)
