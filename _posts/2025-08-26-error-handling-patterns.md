---
layout: post
title: Error Handling Patterns for AI Applications
date: '2025-08-26 10:00:00 +0530'
categories:
  - Guide
  - Patterns
tags:
  - error-handling
  - retries
  - fallbacks
  - resilience
  - recovery
author: neurolink
description: >-
  Handle AI errors gracefully. Retries, fallbacks, user feedback, and recovery
  patterns.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/error-handling-patterns/hero.png
  alt: Error Handling Patterns for AI Applications
---

By the end of this guide, you will have production-grade error handling for your AI application -- exponential backoff with jitter, circuit breakers, multi-provider failover chains, user-friendly error translation, and structured logging that makes debugging possible at 3 AM.

AI applications fail in ways traditional software does not. Rate limits hit mid-stream. Models return malformed JSON. Providers go down for hours. The patterns in this guide handle every failure mode you will encounter with NeuroLink's multi-provider architecture.

## Understanding AI-specific error types

Let's categorize the types of errors you'll encounter when building AI applications. Each type requires different handling strategies.

### Transient Errors

Transient errors are temporary failures that often resolve themselves:

- **Network timeouts**: The request took too long to complete
- **Rate limiting (429 errors)**: You've exceeded the API's request quota
- **Service unavailable (503 errors)**: The AI service is temporarily overloaded
- **Connection resets**: Network interruptions during communication

These errors are prime candidates for retry strategies since they typically succeed on subsequent attempts.

### Input Errors

Input errors occur when the data sent to the AI model is problematic:

- **Token limit exceeded**: Your prompt or context is too long
- **Invalid content**: The input contains content that violates usage policies
- **Malformed requests**: Missing required parameters
- **Invalid model**: Model not found or not supported by provider

Input errors generally won't resolve with retries and require modifying the request itself.

### Output Errors

Sometimes the AI returns something, but it's not what you expected:

- **Malformed JSON**: When expecting structured output, the response doesn't parse
- **Incomplete responses**: The model stopped mid-sentence or mid-structure
- **Hallucinated data**: The model generated plausible but incorrect information
- **Schema violations**: The response doesn't match your expected format

These require validation and potentially re-prompting strategies.

## Basic error handling with NeuroLink

When working with NeuroLink SDK, errors are thrown as standard JavaScript `Error` objects. Here's how to handle them effectively.

### Standard Try-Catch Pattern

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function generateResponse(prompt: string): Promise<string> {
  try {
    const result = await neurolink.generate({
      input: { text: prompt },
      provider: 'openai',
      model: 'gpt-4o',
    });
    return result.content;
  } catch (error) {
    // Always check if it's an Error instance
    if (error instanceof Error) {
      console.error('AI generation failed:', error.message);

      // Check for nested cause (useful for debugging)
      if (error.cause) {
        console.error('Caused by:', error.cause);
      }
    }
    throw error;
  }
}
```

### Identifying Error Types by Properties

Since AI provider errors often come with specific properties, you can inspect them for better handling. Note that `status` and `headers` are not standard Error properties - you'll need to implement custom error classes or use provider-specific error types:

```typescript
// Custom error interface for enhanced error handling
// Note: Implement this based on your error handling needs
interface AIError extends Error {
  code?: string;
  provider?: string;
  // Custom properties - implement based on your error wrapper
  statusCode?: number;
  retryAfterMs?: number;
}

function classifyError(error: unknown): {
  type: string;
  retryable: boolean;
  message: string;
} {
  if (!(error instanceof Error)) {
    return {
      type: 'unknown',
      retryable: false,
      message: 'An unknown error occurred',
    };
  }

  const err = error as AIError;
  const message = err.message.toLowerCase();

  // Rate limit errors (usually 429 status)
  if (err.statusCode === 429 || message.includes('rate limit') || message.includes('429')) {
    return {
      type: 'rate_limit',
      retryable: true,
      message: 'API rate limit exceeded',
    };
  }

  // Authentication errors (401)
  if (err.statusCode === 401 || message.includes('authentication') || message.includes('api key') || message.includes('401')) {
    return {
      type: 'authentication',
      retryable: false,
      message: 'Invalid or missing API key',
    };
  }

  // Authorization errors (403)
  if (err.statusCode === 403 || message.includes('permission') || message.includes('forbidden') || message.includes('403')) {
    return {
      type: 'authorization',
      retryable: false,
      message: 'Insufficient permissions',
    };
  }

  // Network/timeout errors
  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('network') ||
    message.includes('fetch failed')
  ) {
    return {
      type: 'network',
      retryable: true,
      message: 'Network connectivity issue',
    };
  }

  // Server errors (5xx)
  if ((err.statusCode && err.statusCode >= 500 && err.statusCode < 600) || message.includes('500') || message.includes('503')) {
    return {
      type: 'server',
      retryable: true,
      message: 'AI service temporarily unavailable',
    };
  }

  // Model not found
  if (message.includes('model') && (message.includes('not found') || message.includes('invalid'))) {
    return {
      type: 'invalid_model',
      retryable: false,
      message: 'The specified model is not available',
    };
  }

  // Context length exceeded
  if (message.includes('context length') || message.includes('token limit') || message.includes('too long')) {
    return {
      type: 'context_length',
      retryable: false,
      message: 'Input exceeds maximum context length',
    };
  }

  // Default: unknown error
  return {
    type: 'unknown',
    retryable: false,
    message: err.message,
  };
}
```

## Implementing retry strategies

Retries are your first line of defense against transient errors. However, naive retry implementations can make problems worse. Here's how to do it right.

### Exponential Backoff with Jitter

The gold standard for retry strategies is exponential backoff with jitter. This approach spaces out retries exponentially while adding randomness to prevent thundering herd problems.

> **Note**: The following exponential backoff implementation is a recommended pattern, not a built-in SDK feature. You can implement this in your application to enhance retry behavior.

```typescript
// Custom retry configuration - this is a pattern recommendation, not an SDK feature
interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  maxDelayMs: number;
  jitterFactor: number; // 0-1, how much randomness to add
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.5,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: 2^attempt * delayMs
  const exponentialDelay = Math.pow(2, attempt) * config.delayMs;

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: random value between 0 and jitterFactor * delay
  const jitter = Math.random() * config.jitterFactor * cappedDelay;

  return Math.floor(cappedDelay + jitter);
}

function isRetryable(error: unknown): boolean {
  const classification = classifyError(error);
  return classification.retryable;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (!isRetryable(error)) {
        throw lastError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === finalConfig.maxAttempts) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, finalConfig);
      console.log(`Retry ${attempt + 1}/${finalConfig.maxAttempts} after ${delay}ms: ${lastError.message}`);
      await sleep(delay);
    }
  }

  throw lastError;
}

// Usage
async function generateWithRetry(prompt: string): Promise<string> {
  return withRetry(
    async () => {
      const result = await neurolink.generate({
        input: { text: prompt },
        provider: 'openai',
        model: 'gpt-4o',
      });
      return result.content;
    },
    { maxAttempts: 3, delayMs: 1000 }
  );
}
```

### Handling Rate Limits with Retry-After

When APIs return rate limit errors, they often include retry information. Here's how to implement a custom error wrapper that captures this data and respects it:

```typescript
// Custom error wrapper that captures rate limit info
// Implement this in your error handling layer
interface RateLimitError extends Error {
  statusCode: number;
  // Custom properties to extract from API responses
  retryAfterMs?: number;
  rateLimitResetAt?: number;
}

// Helper to extract retry delay from your custom error wrapper
function getRetryAfterMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null;

  const err = error as RateLimitError;

  // Check for custom retryAfterMs property (set by your error wrapper)
  if (err.retryAfterMs && err.retryAfterMs > 0) {
    return err.retryAfterMs;
  }

  // Check for rate limit reset timestamp
  if (err.rateLimitResetAt) {
    const now = Date.now();
    if (err.rateLimitResetAt > now) {
      return err.rateLimitResetAt - now;
    }
  }

  // Parse from error message as fallback
  const match = err.message.match(/retry after (\d+)/i);
  if (match) {
    return parseInt(match[1], 10) * 1000;
  }

  return null;
}

async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const classification = classifyError(error);

      if (classification.type === 'rate_limit' && attempt < maxRetries) {
        // Try to get the retry delay from headers
        let delayMs = getRetryAfterMs(error);

        // Fallback to exponential backoff if no header
        if (delayMs === null) {
          delayMs = Math.pow(2, attempt + 1) * 1000;
        }

        // Cap at 60 seconds
        delayMs = Math.min(delayMs, 60000);

        console.log(`Rate limited. Waiting ${delayMs / 1000}s before retry.`);
        await sleep(delayMs);
        continue;
      }

      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}
```

### Retry Budgets for High-Throughput Systems

In high-throughput systems, unlimited retries can overwhelm services during outages. Implement retry budgets to limit total retry attempts across all requests:

```typescript
class RetryBudget {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private lastRefill: number;

  constructor(maxTokens: number, refillPerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillPerSecond;
    this.lastRefill = Date.now();
  }

  canRetry(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  consumeRetry(): boolean {
    if (!this.canRetry()) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Usage: Allow 10 retries per second across all requests
const globalRetryBudget = new RetryBudget(10, 10);

async function withBudgetedRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isRetryable(error) && globalRetryBudget.consumeRetry()) {
      // Retry allowed
      await sleep(1000);
      return operation();
    }
    throw error;
  }
}
```

## Building graceful degradation systems

When retries fail, your application needs fallback strategies. Graceful degradation ensures users still get value even when primary systems are unavailable.

### Tiered Fallback Chains

Implement a chain of increasingly degraded but available alternatives:

```typescript
interface FallbackResult<T> {
  result: T;
  source: string;
  degraded: boolean;
}

interface FallbackOption<T> {
  name: string;
  handler: () => Promise<T>;
  condition?: (error: Error) => boolean;
}

async function withFallbackChain<T>(
  primary: () => Promise<T>,
  fallbacks: FallbackOption<T>[],
  ultimateFallback: T
): Promise<FallbackResult<T>> {
  // Try primary
  try {
    const result = await primary();
    return { result, source: 'primary', degraded: false };
  } catch (primaryError) {
    console.warn('Primary failed:', primaryError);

    // Try each fallback in order
    for (const fallback of fallbacks) {
      // Check if this fallback applies to this error
      if (fallback.condition && primaryError instanceof Error) {
        if (!fallback.condition(primaryError)) {
          continue;
        }
      }

      try {
        const result = await fallback.handler();
        return { result, source: fallback.name, degraded: true };
      } catch (fallbackError) {
        console.warn(`Fallback ${fallback.name} failed:`, fallbackError);
      }
    }

    // Ultimate fallback
    return {
      result: ultimateFallback,
      source: 'ultimate-fallback',
      degraded: true,
    };
  }
}

// Example: AI-powered search with fallbacks
async function searchWithFallbacks(query: string) {
  return withFallbackChain(
    () => aiPoweredSemanticSearch(query),
    [
      {
        name: 'cached-embeddings',
        handler: () => searchCachedEmbeddings(query),
        condition: (err) => err.message.includes('rate limit'),
      },
      {
        name: 'keyword-search',
        handler: () => elasticSearchFallback(query),
      },
    ],
    { results: [], message: 'Search temporarily unavailable' }
  );
}
```

### Circuit Breakers

Circuit breakers prevent cascading failures by "opening" when a service is failing, avoiding further requests until recovery.

> **Note**: NeuroLink SDK exports `MCPCircuitBreaker` for MCP (Model Context Protocol) tool integration: `new MCPCircuitBreaker('my-service', { failureThreshold: 5, resetTimeout: 30000 })`. The custom implementation below demonstrates a more feature-rich pattern you can adapt for your needs.

```typescript
// Custom CircuitBreaker implementation - this is a pattern recommendation, not an SDK feature
// For MCP tools, use the SDK's MCPCircuitBreaker instead
type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: number = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 30000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure >= this.resetTimeoutMs) {
        this.state = 'half-open';
        this.successes = 0;
        console.log('Circuit breaker: entering half-open state');
      } else {
        throw new Error('Circuit breaker is open - service unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      // Single success in half-open state closes the circuit
      this.state = 'closed';
      this.failures = 0;
      this.successes = 0;
      console.log('Circuit breaker: closed (service recovered)');
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.log('Circuit breaker: opened (too many failures)');
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

// Usage
const aiServiceBreaker = new CircuitBreaker(5, 30000);

async function callAIService(prompt: string): Promise<string> {
  return aiServiceBreaker.execute(async () => {
    const result = await neurolink.generate({
      input: { text: prompt },
      provider: 'openai',
      model: 'gpt-4o',
    });
    return result.content;
  });
}
```

### Provider Failover

NeuroLink supports multiple AI providers. You can implement automatic failover:

```typescript
interface ProviderConfig {
  provider: string;
  model: string;
}

const providers: ProviderConfig[] = [
  { provider: 'openai', model: 'gpt-4o' },
  { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  { provider: 'google-ai', model: 'gemini-1.5-pro' },
];

async function generateWithFailover(prompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (const { provider, model } of providers) {
    try {
      const result = await neurolink.generate({
        input: { text: prompt },
        provider,
        model,
      });
      return result.content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't try other providers for certain errors
      const classification = classifyError(error);
      if (classification.type === 'authentication') {
        throw error; // API key issues affect all providers
      }

      console.warn(`Provider ${provider}/${model} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error('All providers failed');
}
```

## Providing meaningful user feedback

Users should never see raw error messages or be left wondering what happened. Transform technical errors into helpful guidance.

### Error Message Translation

```typescript
interface UserFacingError {
  title: string;
  message: string;
  action?: string;
  retryable: boolean;
}

function translateErrorForUser(error: unknown): UserFacingError {
  const classification = classifyError(error);

  switch (classification.type) {
    case 'rate_limit':
      return {
        title: 'Service is busy',
        message: "We're experiencing high demand right now.",
        action: 'Please wait a moment and try again.',
        retryable: true,
      };

    case 'authentication':
      return {
        title: 'Configuration issue',
        message: 'There was a problem with the service configuration.',
        action: 'Please contact support if this issue persists.',
        retryable: false,
      };

    case 'authorization':
      return {
        title: 'Access denied',
        message: "You don't have permission to perform this action.",
        action: 'Please check your account permissions.',
        retryable: false,
      };

    case 'network':
      return {
        title: 'Connection issue',
        message: "We're having trouble connecting to the AI service.",
        action: 'Please check your connection and try again.',
        retryable: true,
      };

    case 'server':
      return {
        title: 'Service temporarily unavailable',
        message: 'The AI service is experiencing issues.',
        action: 'Please try again in a few moments.',
        retryable: true,
      };

    case 'invalid_model':
      return {
        title: 'Model unavailable',
        message: 'The requested AI model is not available.',
        action: 'Please try a different model.',
        retryable: false,
      };

    case 'context_length':
      return {
        title: 'Input too long',
        message: 'Your input exceeds the maximum allowed length.',
        action: 'Please shorten your input and try again.',
        retryable: false,
      };

    default:
      return {
        title: 'Something went wrong',
        message: 'We encountered an unexpected issue.',
        action: 'Please try again. If the problem continues, contact support.',
        retryable: true,
      };
  }
}
```

### Progressive Loading States

Keep users informed during long operations, especially when retries are happening:

```typescript
type OperationStatus = 'loading' | 'retrying' | 'degraded' | 'error' | 'success';

interface ProgressState {
  status: OperationStatus;
  message: string;
  attempt?: number;
  maxAttempts?: number;
}

type ProgressListener = (state: ProgressState) => void;

class ProgressTracker {
  private listeners: Set<ProgressListener> = new Set();

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(state: ProgressState): void {
    this.listeners.forEach((listener) => listener(state));
  }

  async trackOperation<T>(
    operation: () => Promise<T>,
    options: { maxRetries: number; operationName: string }
  ): Promise<T> {
    this.emit({
      status: 'loading',
      message: `Processing ${options.operationName}...`,
    });

    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.emit({
          status: 'success',
          message: 'Complete!',
        });
        return result;
      } catch (error) {
        if (isRetryable(error) && attempt < options.maxRetries) {
          this.emit({
            status: 'retrying',
            message: 'Temporary issue encountered. Retrying...',
            attempt,
            maxAttempts: options.maxRetries,
          });
          await sleep(Math.pow(2, attempt) * 1000);
        } else {
          const userError = translateErrorForUser(error);
          this.emit({
            status: 'error',
            message: userError.message,
          });
          throw error;
        }
      }
    }

    throw new Error('Unexpected end of retry loop');
  }
}
```

## Logging and observability

Effective error handling requires visibility into what's happening.

### Structured Error Logging

```typescript
interface ErrorLogEntry {
  timestamp: string;
  level: 'warn' | 'error';
  errorType: string;
  message: string;
  context: {
    requestId?: string;
    userId?: string;
    operation: string;
    model?: string;
    attempt?: number;
  };
  stack?: string;
  cause?: string;
}

function logError(
  error: unknown,
  context: ErrorLogEntry['context']
): ErrorLogEntry {
  const classification = classifyError(error);
  const isErr = error instanceof Error;

  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: classification.retryable ? 'warn' : 'error',
    errorType: classification.type,
    message: isErr ? error.message : String(error),
    context,
    stack: isErr ? error.stack : undefined,
    cause: isErr && error.cause ? String(error.cause) : undefined,
  };

  // Log to console (or your logging service)
  if (entry.level === 'error') {
    console.error(JSON.stringify(entry, null, 2));
  } else {
    console.warn(JSON.stringify(entry, null, 2));
  }

  return entry;
}

// Usage
async function generateWithLogging(prompt: string, requestId: string): Promise<string> {
  try {
    const result = await neurolink.generate({
      input: { text: prompt },
      provider: 'openai',
      model: 'gpt-4o',
    });
    return result.content;
  } catch (error) {
    logError(error, {
      requestId,
      operation: 'generate',
      model: 'openai/gpt-4o',
    });
    throw error;
  }
}
```

### Error Metrics

Track error rates and types for monitoring:

```typescript
class ErrorMetrics {
  private counts: Map<string, number> = new Map();
  private timestamps: Map<string, number[]> = new Map();

  record(errorType: string): void {
    // Increment count
    const current = this.counts.get(errorType) ?? 0;
    this.counts.set(errorType, current + 1);

    // Track timestamp for rate calculation
    const times = this.timestamps.get(errorType) ?? [];
    times.push(Date.now());
    // Keep only last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.timestamps.set(
      errorType,
      times.filter((t) => t > fiveMinutesAgo)
    );
  }

  getCount(errorType: string): number {
    return this.counts.get(errorType) ?? 0;
  }

  getRate(errorType: string): number {
    const times = this.timestamps.get(errorType) ?? [];
    if (times.length === 0) return 0;

    // Errors per minute over last 5 minutes
    return times.length / 5;
  }

  getSummary(): Record<string, { count: number; ratePerMinute: number }> {
    const summary: Record<string, { count: number; ratePerMinute: number }> = {};

    for (const [type, count] of this.counts) {
      summary[type] = {
        count,
        ratePerMinute: this.getRate(type),
      };
    }

    return summary;
  }
}

const errorMetrics = new ErrorMetrics();

// Use in error handling
function handleAndTrackError(error: unknown): void {
  const classification = classifyError(error);
  errorMetrics.record(classification.type);
}
```

## Recovery patterns

Beyond handling errors, plan for recovery from various failure scenarios.

### Checkpoint and Resume

For long-running AI operations, save progress to enable resumption:

```typescript
interface Checkpoint<T> {
  id: string;
  operation: string;
  progress: number;
  partialResult: Partial<T>;
  context: unknown;
  createdAt: string;
  expiresAt: string;
}

class CheckpointManager {
  private storage: Map<string, Checkpoint<unknown>> = new Map();

  async saveCheckpoint<T>(
    operationId: string,
    operation: string,
    progress: number,
    partialResult: Partial<T>,
    context: unknown
  ): Promise<void> {
    const checkpoint: Checkpoint<T> = {
      id: operationId,
      operation,
      progress,
      partialResult,
      context,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    this.storage.set(operationId, checkpoint);
  }

  async loadCheckpoint<T>(operationId: string): Promise<Checkpoint<T> | null> {
    const checkpoint = this.storage.get(operationId) as Checkpoint<T>;

    if (!checkpoint) return null;

    if (new Date(checkpoint.expiresAt) < new Date()) {
      this.storage.delete(operationId);
      return null;
    }

    return checkpoint;
  }

  async clearCheckpoint(operationId: string): Promise<void> {
    this.storage.delete(operationId);
  }
}
```

### Idempotency for Safe Retries

Ensure operations can be safely retried without side effects:

```typescript
class IdempotencyManager {
  private completedOperations: Map<string, { result: unknown; expiresAt: number }> = new Map();

  async executeIdempotent<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
    ttlMs: number = 3600000
  ): Promise<T> {
    // Check if already completed
    const existing = this.completedOperations.get(idempotencyKey);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.result as T;
    }

    // Execute operation
    const result = await operation();

    // Store result
    this.completedOperations.set(idempotencyKey, {
      result,
      expiresAt: Date.now() + ttlMs,
    });

    return result;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.completedOperations) {
      if (value.expiresAt <= now) {
        this.completedOperations.delete(key);
      }
    }
  }
}

// Usage
const idempotency = new IdempotencyManager();

async function createAIAnalysis(requestId: string, data: string): Promise<string> {
  return idempotency.executeIdempotent(`analysis:${requestId}`, () =>
    neurolink.generate({
      input: { text: `Analyze: ${data}` },
      provider: 'openai',
      model: 'gpt-4o',
    }).then((r) => r.content)
  );
}
```

## Putting it all together

Here's a comprehensive example that combines all the error handling patterns:

```typescript
import { NeuroLink } from '@juspay/neurolink';

interface ProviderConfig {
  provider: string;
  model: string;
}

// Create a resilient AI client
class ResilientAIClient {
  private neurolink: NeuroLink;
  private circuitBreaker: CircuitBreaker;
  private retryBudget: RetryBudget;
  private errorMetrics: ErrorMetrics;
  private providers: ProviderConfig[];

  constructor(
    providers: ProviderConfig[] = [
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    ]
  ) {
    this.neurolink = new NeuroLink();
    this.circuitBreaker = new CircuitBreaker(5, 30000);
    this.retryBudget = new RetryBudget(10, 10);
    this.errorMetrics = new ErrorMetrics();
    this.providers = providers;
  }

  async generate(prompt: string): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      return this.withRetryAndFallback(prompt);
    });
  }

  private async withRetryAndFallback(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (const { provider, model } of this.providers) {
      try {
        return await withRetry(
          async () => {
            const result = await this.neurolink.generate({
              input: { text: prompt },
              provider,
              model,
            });
            return result.content;
          },
          { maxAttempts: 2, delayMs: 1000 }
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const classification = classifyError(error);

        // Track the error
        this.errorMetrics.record(classification.type);

        // Don't try other providers for auth errors
        if (classification.type === 'authentication') {
          throw error;
        }

        console.warn(`Provider ${provider}/${model} failed:`, lastError.message);
      }
    }

    throw lastError ?? new Error('All providers failed');
  }

  getErrorSummary() {
    return this.errorMetrics.getSummary();
  }

  getCircuitState() {
    return this.circuitBreaker.getState();
  }
}

// Usage
async function main() {
  const client = new ResilientAIClient();

  try {
    const response = await client.generate('Explain quantum computing');
    console.log(response);
  } catch (error) {
    // Handle final error with user-friendly message
    const userError = translateErrorForUser(error);
    console.error(`${userError.title}: ${userError.message}`);

    if (userError.action) {
      console.log(`Suggestion: ${userError.action}`);
    }
  }

  // Check system health
  console.log('Circuit state:', client.getCircuitState());
  console.log('Error summary:', client.getErrorSummary());
}
```

## Error handling quick reference

| Error Type | Retryable | Strategy |
|------------|-----------|----------|
| Rate limit (429) | Yes | Exponential backoff, respect Retry-After |
| Network/timeout | Yes | Retry with backoff |
| Server error (5xx) | Yes | Retry, then failover |
| Authentication (401) | No | Check API keys, alert |
| Authorization (403) | No | Check permissions |
| Invalid model | No | Use fallback model |
| Context too long | No | Truncate input |

## Conclusion

By now you have a complete error handling toolkit: error classification, exponential backoff with jitter, circuit breakers, fallback chains, user-friendly error translation, structured logging, error metrics, and recovery patterns.

The implementation order:

1. Add error classification and structured logging first -- visibility before optimization
2. Add retry with backoff for transient failures
3. Add circuit breakers and fallback chains for provider resilience
4. Add user-facing error translation and progress tracking
5. Add checkpoint/resume and idempotency for long-running operations

Start with the most common failure modes in your application and add patterns incrementally.

## Further reading

- [Provider Failover Patterns](/posts/provider-failover-patterns/) -- Automatic switching between AI providers
- [Testing AI Applications](/posts/testing-ai-applications/) -- Test error handling scenarios
- [Performance Benchmarking Guide](/posts/performance-benchmarks/) -- Measure impact of error handling on performance

---

**Related posts:**

- [Multi-Provider Failover: Never Lose an API Call](/posts/provider-failover-patterns/)
- [Testing AI Applications: A Complete Guide](/posts/testing-ai-applications/)
- [LLM Cost Optimization: Practical Strategies to Reduce Your AI Spend](/posts/cost-optimization-strategies/)
