---
layout: post
title: Performance Benchmarking Guide for NeuroLink
date: '2025-07-30 10:00:00 +0530'
author: neurolink
description: >-
  A comprehensive guide to benchmarking AI SDK performance, with reproducible
  methodologies and best practices for measuring latency, throughput, and memory
  usage.
categories:
  - Technical
  - Guide
tags:
  - benchmarks
  - performance
  - latency
  - throughput
  - testing
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/performance-benchmarks/hero.png
  alt: Performance Benchmarking Guide for NeuroLink
---

By the end of this guide, you'll have a reproducible benchmarking setup for measuring NeuroLink's performance -- latency, throughput, memory usage, and streaming speed -- against your specific workloads.

You will build benchmark scripts, measure cold-start and warm performance, compare providers, and identify bottlenecks. No unverifiable numbers here -- everything is a methodology you run yourself.

---

## Why Benchmark Yourself?

Published benchmarks often fail to represent your actual use case. Your results will vary based on:

- **Geographic location** relative to API endpoints
- **Prompt complexity and length** (token counts vary significantly)
- **Provider rate limits** tied to your account tier
- **Network conditions** and latency to providers
- **Concurrent load patterns** specific to your application
- **Model selection** (different models have vastly different performance)

The only benchmarks that matter are the ones you run against your actual workloads in your actual environment.

---

## Benchmark Methodology

### Environment Setup

Create a consistent, reproducible testing environment:

```typescript
// benchmark-config.ts
import { NeuroLink } from '@juspay/neurolink';

export const benchmarkConfig = {
  // Warm-up eliminates JIT compilation effects
  warmupRequests: 100,
  // Enough samples for statistical significance
  measurementRequests: 1000,
  // Test different load levels
  concurrencyLevels: [1, 5, 10, 25, 50],
  // Allow system to stabilize between tests
  cooldownBetweenTests: 2000, // ms
};

// Document your test environment
export const environmentInfo = {
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  timestamp: new Date().toISOString(),
};
```

### Testing Principles

Follow these principles for meaningful results:

1. **Warm-up period**: Run requests before measurement to eliminate cold start effects
2. **Statistical significance**: Collect enough samples (minimum 100-1000) for reliable percentiles
3. **Controlled variables**: Use the same model, prompts, and expected output length
4. **Isolation**: Fresh process for each test suite to avoid memory buildup
5. **Percentile reporting**: Report P50, P95, P99 latencies (averages hide outliers)

```typescript
// Basic statistical utilities
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Use reduce-based min/max to avoid call stack overflow with large arrays
function calculateStats(values: number[]) {
  return {
    min: values.reduce((min, v) => Math.min(min, v), Infinity),
    max: values.reduce((max, v) => Math.max(max, v), -Infinity),
    p50: calculatePercentile(values, 50),
    p95: calculatePercentile(values, 95),
    p99: calculatePercentile(values, 99),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  };
}
```

---

## Latency Benchmarks

### Single Request Latency

Measure time from request initiation to complete response:

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

async function measureSingleRequestLatency(
  provider: string,
  model: string,
  prompt: string,
  iterations: number
): Promise<number[]> {
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    await neurolink.generate({
      input: { text: prompt },
      provider: provider,
      model: model,
    });

    latencies.push(performance.now() - start);

    // Optional: add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return latencies;
}

// Example usage
async function runLatencyBenchmark() {
  console.log('Running latency benchmark...\n');
  console.log('Environment:', JSON.stringify(environmentInfo, null, 2));

  const testPrompt = 'Explain the concept of recursion in programming.';

  // Warm-up
  console.log('Warming up...');
  await measureSingleRequestLatency('vertex', 'gemini-2.0-flash', testPrompt, 10);

  // Measurement
  console.log('Measuring...');
  const latencies = await measureSingleRequestLatency(
    'vertex',
    'gemini-2.0-flash',
    testPrompt,
    100
  );

  const stats = calculateStats(latencies);
  console.log('\nLatency Results (ms):');
  console.log(`  P50: ${stats.p50.toFixed(2)}`);
  console.log(`  P95: ${stats.p95.toFixed(2)}`);
  console.log(`  P99: ${stats.p99.toFixed(2)}`);
  console.log(`  Avg: ${stats.avg.toFixed(2)}`);
}
```

### Streaming Latency (Time to First Byte)

For streaming responses, Time to First Byte (TTFB) measures perceived responsiveness:

```typescript
const neurolink = new NeuroLink();

async function measureStreamingTTFB(
  provider: string,
  model: string,
  prompt: string,
  iterations: number
): Promise<{ ttfb: number[]; totalTime: number[] }> {
  const ttfbValues: number[] = [];
  const totalTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    let firstChunkTime: number | null = null;

    const result = await neurolink.stream({
      input: { text: prompt },
      provider: provider,
      model: model,
    });

    for await (const chunk of result.stream) {
      if (firstChunkTime === null) {
        firstChunkTime = performance.now() - start;
      }
      // Consume the stream
    }

    const totalTime = performance.now() - start;

    if (firstChunkTime !== null) {
      ttfbValues.push(firstChunkTime);
    }
    totalTimes.push(totalTime);

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { ttfb: ttfbValues, totalTime: totalTimes };
}
```

---

## Throughput Benchmarks

### Concurrent Request Handling

Test how many requests per second you can sustain:

```typescript
import pLimit from 'p-limit';

async function measureThroughput(
  provider: string,
  model: string,
  prompt: string,
  concurrency: number,
  durationMs: number
): Promise<{ requestsPerSecond: number; errorRate: number }> {
  const limit = pLimit(concurrency);
  const results: { success: boolean; duration: number }[] = [];

  const startTime = Date.now();
  const promises: Promise<void>[] = [];

  // Keep spawning requests until duration is reached
  while (Date.now() - startTime < durationMs) {
    const promise = limit(async () => {
      const reqStart = performance.now();
      try {
        await neurolink.generate({
          input: { text: prompt },
          provider: provider,
          model: model,
        });
        results.push({ success: true, duration: performance.now() - reqStart });
      } catch (error) {
        results.push({ success: false, duration: performance.now() - reqStart });
      }
    });
    promises.push(promise);

    // Small delay to prevent overwhelming the event loop
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Wait for all in-flight requests to complete
  await Promise.all(promises);

  const actualDuration = (Date.now() - startTime) / 1000;
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return {
    requestsPerSecond: successCount / actualDuration,
    errorRate: errorCount / results.length,
  };
}

async function runThroughputBenchmark() {
  console.log('Running throughput benchmark...\n');

  const testPrompt = 'What is 2 + 2?'; // Short prompt for throughput testing
  const testDuration = 30000; // 30 seconds per test

  for (const concurrency of [1, 5, 10, 25]) {
    console.log(`Testing concurrency: ${concurrency}`);

    const result = await measureThroughput(
      'vertex',
      'gemini-2.0-flash',
      testPrompt,
      concurrency,
      testDuration
    );

    console.log(`  Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`  Error rate: ${(result.errorRate * 100).toFixed(2)}%`);
    console.log();
  }
}
```

---

## Memory Usage Benchmarks

### Idle Memory Footprint

Measure base memory consumption after initialization:

```typescript
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: usage.heapUsed / 1024 / 1024,
    heapTotalMB: usage.heapTotal / 1024 / 1024,
    externalMB: usage.external / 1024 / 1024,
    rssMB: usage.rss / 1024 / 1024,
  };
}

async function measureIdleMemory() {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const baseline = getMemoryUsage();
  console.log('Baseline memory (before initialization):');
  console.log(`  Heap Used: ${baseline.heapUsedMB.toFixed(2)} MB`);

  // Initialize NeuroLink
  const neurolink = new NeuroLink();

  // Allow initialization to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (global.gc) {
    global.gc();
  }

  const afterInit = getMemoryUsage();
  console.log('\nAfter initialization:');
  console.log(`  Heap Used: ${afterInit.heapUsedMB.toFixed(2)} MB`);
  console.log(`  Delta: +${(afterInit.heapUsedMB - baseline.heapUsedMB).toFixed(2)} MB`);
}
```

### Memory Under Load

Track memory growth during sustained operations:

```typescript
async function measureMemoryUnderLoad(
  provider: string,
  model: string,
  requestCount: number
) {
  const memorySnapshots: { requestNum: number; heapUsedMB: number }[] = [];

  const neurolink = new NeuroLink();

  for (let i = 0; i < requestCount; i++) {
    await neurolink.generate({
      input: { text: 'Hello, world!' },
      provider: provider,
      model: model,
    });

    // Snapshot memory every 10 requests
    if (i % 10 === 0) {
      const mem = getMemoryUsage();
      memorySnapshots.push({
        requestNum: i,
        heapUsedMB: mem.heapUsedMB,
      });
    }
  }

  // Analyze memory growth
  const firstSnapshot = memorySnapshots[0];
  const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];

  console.log('Memory growth analysis:');
  console.log(`  Start: ${firstSnapshot.heapUsedMB.toFixed(2)} MB`);
  console.log(`  End: ${lastSnapshot.heapUsedMB.toFixed(2)} MB`);
  console.log(`  Growth: ${(lastSnapshot.heapUsedMB - firstSnapshot.heapUsedMB).toFixed(2)} MB`);
  console.log(`  Growth rate: ${((lastSnapshot.heapUsedMB - firstSnapshot.heapUsedMB) / requestCount * 100).toFixed(4)} MB per 100 requests`);

  return memorySnapshots;
}
```

---

## Provider Comparison Framework

When comparing different providers, ensure fair comparison:

```typescript
interface BenchmarkResult {
  provider: string;
  model: string;
  latencyStats: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  memoryUsage: number;
}

async function compareProviders(
  configs: Array<{ provider: string; model: string }>,
  prompt: string,
  iterations: number
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const config of configs) {
    console.log(`\nBenchmarking ${config.provider}/${config.model}...`);

    // Latency test
    const latencies = await measureSingleRequestLatency(
      config.provider,
      config.model,
      prompt,
      iterations
    );

    const latencyStats = calculateStats(latencies);

    // Throughput test (shorter duration for comparison)
    const throughput = await measureThroughput(
      config.provider,
      config.model,
      prompt,
      10, // concurrency
      10000 // 10 seconds
    );

    // Memory snapshot
    const memory = getMemoryUsage();

    results.push({
      provider: config.provider,
      model: config.model,
      latencyStats: {
        p50: latencyStats.p50,
        p95: latencyStats.p95,
        p99: latencyStats.p99,
      },
      throughput: throughput.requestsPerSecond,
      errorRate: throughput.errorRate,
      memoryUsage: memory.heapUsedMB,
    });

    // Cool down between providers
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return results;
}

// Example: Compare multiple providers
async function runProviderComparison() {
  const configs = [
    { provider: 'vertex', model: 'gemini-2.0-flash' },
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
  ];

  const results = await compareProviders(
    configs,
    'What is the capital of France?',
    50
  );

  console.log('\n=== Comparison Results ===\n');
  console.table(results.map(r => ({
    'Provider': `${r.provider}/${r.model}`,
    'P50 (ms)': r.latencyStats.p50.toFixed(0),
    'P95 (ms)': r.latencyStats.p95.toFixed(0),
    'Req/s': r.throughput.toFixed(1),
    'Errors': `${(r.errorRate * 100).toFixed(1)}%`,
  })));
}
```

---

## Best Practices for Benchmarking

### 1. Document Everything

Always record your test conditions:

```typescript
function generateBenchmarkReport(results: any) {
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      neuroLinkVersion: require('@juspay/neurolink/package.json').version,
    },
    configuration: benchmarkConfig,
    results: results,
  };
}
```

### 2. Account for Rate Limits

Provider rate limits significantly affect throughput results:

```typescript
// Add delays to stay within rate limits
async function rateLimitAwareBenchmark(
  requestsPerMinute: number,
  totalRequests: number
) {
  const delayMs = (60 * 1000) / requestsPerMinute;

  for (let i = 0; i < totalRequests; i++) {
    // Your benchmark code here
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
```

### 3. Test Realistic Workloads

Use prompts and patterns that match your actual use case:

```typescript
// Bad: Synthetic micro-benchmark
const syntheticPrompt = 'Hi';

// Good: Representative workload
const realisticPrompts = [
  'Summarize the following document: [1000 word document]',
  'Translate this paragraph to Spanish: [paragraph]',
  'Generate a product description for: [product details]',
];
```

### 4. Run Multiple Times

Single runs are unreliable. Run benchmarks multiple times and report variance:

```typescript
async function runWithVariance(
  benchmarkFn: () => Promise<number>,
  runs: number
): Promise<{ mean: number; stdDev: number; values: number[] }> {
  const values: number[] = [];

  for (let i = 0; i < runs; i++) {
    values.push(await benchmarkFn());
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, values };
}
```

---

## Interpreting Results

### What to Look For

1. **P99 vs P50**: Large gaps indicate inconsistent performance
2. **Error rates under load**: Should remain near zero
3. **Memory growth over time**: Linear growth suggests potential leaks
4. **Throughput scaling**: Should increase with concurrency (up to a point)

### Red Flags

- P99 latency more than 5x P50
- Error rates above 1% under normal load
- Memory growth that doesn't stabilize
- Throughput that decreases at higher concurrency

---

## Conclusion

By now you have a complete benchmarking methodology: harness setup, metric collection, statistical analysis, and red-flag detection. Use it to:

1. Establish your own baseline metrics in your environment
2. Compare providers fairly for your specific workloads
3. Detect performance regressions over time
4. Make data-driven optimization decisions

Published benchmarks from any vendor (including us) are starting points, not guarantees. The numbers that matter are the ones you measure yourself.

## Further Reading

- [NeuroLink SDK Documentation](https://docs.neurolink.ink/)

---

**Related posts:**

- [Real-Time AI: Streaming Response Patterns with NeuroLink](/posts/streaming-best-practices/)
- [Multi-Provider Failover: Never Lose an API Call](/posts/provider-failover-patterns/)
- [Provider Comparison Matrix: Choosing the Right AI Provider](/posts/provider-comparison-matrix/)
