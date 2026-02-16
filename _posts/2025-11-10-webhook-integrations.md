---
layout: post
title: Building Webhook Handlers with NeuroLink AI Processing
date: '2025-11-10 10:00:00 +0530'
categories:
  - Tutorial
  - Integration
tags:
  - webhooks
  - events
  - async
  - integration
  - automation
author: neurolink
description: >-
  Build webhook handlers that leverage NeuroLink for AI processing. Learn event
  handling, async processing, and integration patterns using Express.js with
  NeuroLink as your AI backend.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/webhook-integrations/hero.png
  alt: Building Webhook Handlers with NeuroLink AI Processing
---

> **Important Clarification**: NeuroLink is an AI generation SDK - it does not provide webhook infrastructure. This tutorial demonstrates how to build your own webhook handlers (using Express.js, Fastify, or similar frameworks) that leverage NeuroLink for intelligent AI processing of incoming events. You are responsible for building and hosting the webhook endpoints; NeuroLink handles the AI generation when your handlers need to analyze, classify, or respond to events intelligently.
{: .prompt-info }

You will build webhook handlers that use NeuroLink for AI processing of incoming events. By the end of this tutorial, you will have Express.js webhook endpoints that classify, analyze, and respond to events intelligently using NeuroLink's generation API -- transforming simple notification receivers into automated AI pipelines.

You will build the webhook infrastructure yourself using Node.js and Express, while NeuroLink serves as your AI backend. Now you will set up the project and build your first intelligent webhook handler.

## External Dependencies

This tutorial requires several npm packages for webhook integration:

```bash
npm install @juspay/neurolink express
npm install @slack/web-api @octokit/rest
# or
npm install @juspay/neurolink fastify
npm install @slack/web-api @octokit/rest
```

**Required Packages:**

- `@juspay/neurolink` - NeuroLink SDK for AI generation
- `express` or `fastify` - Web framework for building webhook endpoints
- `@slack/web-api` - Slack API client (for Slack integrations)
- `@octokit/rest` - GitHub API client (for GitHub integrations)

## Prerequisites

Before building webhook handlers with NeuroLink AI processing, ensure you have:

- **Node.js 18+** and npm/yarn/pnpm installed
- **Express.js or Fastify** for building webhook endpoints
- **NeuroLink SDK**: `npm install @juspay/neurolink`
- **External service SDKs** (when integrating with platforms):
  - `@slack/web-api` for Slack integrations
  - `@octokit/rest` for GitHub webhook handlers
- Basic understanding of webhooks, HTTP POST requests, and async/await
- A code editor and familiarity with TypeScript

## Understanding Webhook Fundamentals

Webhooks represent a paradigm shift from traditional polling-based integrations. Instead of repeatedly asking external services for updates, webhooks deliver data to your application the moment events occur. This push-based model reduces latency, conserves resources, and enables truly responsive applications.

### The Anatomy of a Webhook

A webhook consists of several key components working together:

```text
+------------------+         HTTP POST          +------------------+
|  Source System   | -------------------------> |  Your Endpoint   |
|   (Provider)     |                            |   (Consumer)     |
+------------------+                            +------------------+
        |                                              |
        |  Event Occurs                                |  Process Event
        |  Serialize Payload                           |  Validate Signature
        |  Sign Request                                |  Parse Payload
        |  Send HTTP POST                              |  Execute Logic
        |                                              |  Return Response
```

The webhook payload typically contains:

- **Event type**: Identifies what happened (e.g., `user.created`, `payment.completed`)
- **Timestamp**: When the event occurred
- **Resource data**: The actual event payload
- **Metadata**: Additional context like request IDs and versions

### Setting Up Your Webhook Endpoint with NeuroLink AI Processing

Let's create a basic webhook receiver using Express.js that integrates with NeuroLink for AI-powered event processing. Note that the webhook endpoint itself is built with Express - NeuroLink is initialized separately to handle AI generation when needed:

```typescript
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { NeuroLink } from '@juspay/neurolink';

const app = express();
app.use(express.json({ verify: rawBodySaver }));

// Initialize NeuroLink with optional configuration
const neurolink = new NeuroLink({
  conversationMemory: { enabled: true },
});

// Store your webhook secret securely
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

// Middleware to capture raw body for signature verification
function rawBodySaver(
  req: Request,
  _res: Response,
  buf: Buffer
): void {
  (req as any).rawBody = buf;
}

// Verify webhook signature using HMAC-SHA256
function verifySignature(payload: Buffer, signature: string): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expected}`),
    Buffer.from(signature)
  );
}

app.post('/webhooks/incoming', async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody as Buffer;
  const signature = req.headers['x-webhook-signature'] as string;

  // Verify the webhook signature
  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  const eventType = event.type;

  // Acknowledge receipt immediately
  res.status(200).json({ status: 'received' });

  // Process asynchronously
  processWebhookEvent(event).catch(console.error);
});

async function processWebhookEvent(event: any): Promise<void> {
  const eventType = event.type;

  switch (eventType) {
    case 'message.received':
      await processMessage(event);
      break;
    case 'user.created':
      await processNewUser(event);
      break;
    case 'document.uploaded':
      await processDocument(event);
      break;
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
}
```

This foundation establishes secure webhook reception with signature verification, event routing, and quick acknowledgment - all essential for production deployments. The Express server handles HTTP concerns while NeuroLink stands ready to process events with AI when your handlers call it.

## Building Event Handlers with AI Processing

The real power emerges when you connect your webhook handlers to NeuroLink's AI processing capabilities. Each incoming event becomes an opportunity for intelligent analysis and automated response - your Express handlers receive the events, and NeuroLink provides the AI intelligence to understand and respond to them.

### Designing an Event Handler Architecture

A well-structured event handler separates concerns and enables scalable processing:

```typescript
import { NeuroLink, GenerateOptions, GenerateResult } from '@juspay/neurolink';

// Base interface for event handlers
interface EventHandler {
  canHandle(eventType: string): boolean;
  process(event: WebhookEvent): Promise<ProcessingResult>;
}

interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, any>;
  source?: string;
}

interface ProcessingResult {
  status: 'processed' | 'error' | 'skipped';
  analysis?: Record<string, any>;
  response?: string;
  actions?: Array<{ type: string; details: Record<string, any> }>;
}

class MessageEventHandler implements EventHandler {
  private neurolink: NeuroLink;

  constructor(neurolinkInstance: NeuroLink) {
    this.neurolink = neurolinkInstance;
  }

  canHandle(eventType: string): boolean {
    return eventType.startsWith('message.');
  }

  async process(event: WebhookEvent): Promise<ProcessingResult> {
    const messageContent = event.data?.content || '';
    const sender = event.data?.sender || {};
    const channel = event.data?.channel;

    // Use NeuroLink to analyze the message and generate response
    const analysisResult = await this.neurolink.generate({
      input: {
        text: `Analyze this customer message and provide:
1. Sentiment (positive/neutral/negative with score -1 to 1)
2. Intent (support_request/product_inquiry/feedback/complaint/other)
3. Key entities mentioned
4. Suggested response

Message: "${messageContent}"

Respond in JSON format with keys: sentiment, intent, entities, suggestedResponse`
      },
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.3,
      systemPrompt: 'You are a customer service analysis assistant. Analyze messages and provide structured insights.',
    });

    // Parse the AI analysis
    let analysis: Record<string, any>;
    try {
      analysis = JSON.parse(analysisResult.content);
    } catch {
      analysis = { rawAnalysis: analysisResult.content };
    }

    // Generate appropriate response based on intent
    const responseResult = await this.generateResponse(
      messageContent,
      analysis,
      channel
    );

    // Determine follow-up actions
    const actions = this.determineActions(analysis);

    return {
      status: 'processed',
      analysis,
      response: responseResult.content,
      actions,
    };
  }

  private async generateResponse(
    message: string,
    analysis: Record<string, any>,
    channel?: string
  ): Promise<GenerateResult> {
    const intent = analysis.intent || 'general';
    const sentiment = analysis.sentiment?.score || 0;

    let systemPrompt = 'You are a helpful customer service representative. ';

    if (intent === 'support_request') {
      systemPrompt += 'Provide empathetic, solution-focused support.';
    } else if (intent === 'product_inquiry') {
      systemPrompt += 'Be informative and highlight product benefits.';
    } else if (sentiment < -0.3) {
      systemPrompt += 'Be extra empathetic and apologetic. Focus on resolution.';
    }

    return await this.neurolink.generate({
      input: {
        text: `Generate a professional response to: "${message}"

Context:
- Intent: ${intent}
- Sentiment: ${sentiment}
- Channel: ${channel || 'unknown'}

Keep response concise and actionable.`
      },
      temperature: 0.7,
      maxTokens: 300,
      systemPrompt,
    });
  }

  private determineActions(analysis: Record<string, any>): Array<{ type: string; details: Record<string, any> }> {
    const actions: Array<{ type: string; details: Record<string, any> }> = [];

    // Escalate negative sentiment
    if (analysis.sentiment?.score < -0.5) {
      actions.push({
        type: 'escalate',
        details: {
          priority: 'high',
          reason: 'negative_sentiment',
          score: analysis.sentiment.score,
        },
      });
    }

    // Notify team for urgent keywords
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical'];
    const entities = analysis.entities || [];
    if (entities.some((e: string) => urgentKeywords.includes(e.toLowerCase()))) {
      actions.push({
        type: 'notify_team',
        details: {
          channel: 'urgent-support',
          reason: 'urgent_keyword_detected',
        },
      });
    }

    return actions;
  }
}
```

### Implementing the Event Router

The event router coordinates between incoming webhooks and appropriate handlers:

```typescript
import { NeuroLink } from '@juspay/neurolink';

interface RouterResult {
  status: 'processed' | 'error' | 'unhandled';
  handler?: string;
  result?: ProcessingResult;
  error?: string;
  eventType?: string;
}

class EventRouter {
  private handlers: EventHandler[] = [];
  private fallbackHandler?: EventHandler;

  registerHandler(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  setFallback(handler: EventHandler): void {
    this.fallbackHandler = handler;
  }

  async route(event: WebhookEvent): Promise<RouterResult> {
    const eventType = event.type || '';

    for (const handler of this.handlers) {
      if (handler.canHandle(eventType)) {
        try {
          const result = await handler.process(event);
          return {
            status: 'processed',
            handler: handler.constructor.name,
            result,
          };
        } catch (error) {
          return {
            status: 'error',
            handler: handler.constructor.name,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    // Try fallback handler
    if (this.fallbackHandler) {
      const result = await this.fallbackHandler.process(event);
      return {
        status: 'processed',
        handler: 'FallbackHandler',
        result,
      };
    }

    return {
      status: 'unhandled',
      eventType,
    };
  }
}

// Initialize the router with handlers
const neurolink = new NeuroLink();
const router = new EventRouter();

router.registerHandler(new MessageEventHandler(neurolink));
router.registerHandler(new DocumentEventHandler(neurolink));
router.registerHandler(new UserEventHandler(neurolink));
```

## Asynchronous AI Processing Patterns

Webhook handlers must respond quickly - typically within seconds - to avoid timeouts. However, AI processing can take longer. The solution lies in asynchronous processing patterns that decouple receipt from execution.

### Queue-Based Processing Architecture

Implement a robust queue-based system for handling AI workloads:

```typescript
import { NeuroLink } from '@juspay/neurolink';
import Redis from 'ioredis';

interface QueuedEvent {
  id: string;
  eventType: string;
  payload: Record<string, any>;
  queuedAt: Date;
  priority: number;
  retryCount: number;
  maxRetries: number;
}

class WebhookQueue {
  private redis: Redis;
  private readonly queueName = 'webhook:events';
  private readonly processingQueue = 'webhook:processing';
  private readonly deadLetterQueue = 'webhook:dead_letter';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async enqueue(event: QueuedEvent): Promise<void> {
    const eventData = JSON.stringify({
      id: event.id,
      type: event.eventType,
      payload: event.payload,
      queuedAt: event.queuedAt.toISOString(),
      priority: event.priority,
      retryCount: event.retryCount,
      maxRetries: event.maxRetries,
    });

    // Use sorted set for priority queue
    await this.redis.zadd(this.queueName, event.priority, eventData);
  }

  async dequeue(): Promise<QueuedEvent | null> {
    // Get highest priority item (lowest score)
    const result = await this.redis.bzpopmin(this.queueName, 5);

    if (!result) return null;

    const [, eventJson] = result;
    const eventData = JSON.parse(eventJson);

    // Track in processing queue
    await this.redis.hset(
      this.processingQueue,
      eventData.id,
      eventJson
    );

    return {
      id: eventData.id,
      eventType: eventData.type,
      payload: eventData.payload,
      queuedAt: new Date(eventData.queuedAt),
      priority: eventData.priority,
      retryCount: eventData.retryCount,
      maxRetries: eventData.maxRetries,
    };
  }

  async complete(eventId: string): Promise<void> {
    await this.redis.hdel(this.processingQueue, eventId);
  }

  async retry(event: QueuedEvent): Promise<void> {
    if (event.retryCount >= event.maxRetries) {
      await this.moveToDeadLetter(event);
      return;
    }

    // Exponential backoff
    const delay = Math.pow(2, event.retryCount) * 1000;

    await new Promise(resolve => setTimeout(resolve, delay));

    await this.enqueue({
      ...event,
      retryCount: event.retryCount + 1,
      priority: event.priority + event.retryCount, // Lower priority for retries
    });
  }

  private async moveToDeadLetter(event: QueuedEvent): Promise<void> {
    await this.redis.lpush(
      this.deadLetterQueue,
      JSON.stringify({
        event,
        failedAt: new Date().toISOString(),
      })
    );
  }
}
```

### Worker Process Implementation

Create worker processes that consume from the queue and perform AI processing:

```typescript
import { NeuroLink } from '@juspay/neurolink';

interface WorkerMetrics {
  processed: number;
  errors: number;
  retries: number;
  processingTimes: number[];
}

class WebhookWorker {
  private queue: WebhookQueue;
  private router: EventRouter;
  private running = false;
  private metrics: WorkerMetrics = {
    processed: 0,
    errors: 0,
    retries: 0,
    processingTimes: [],
  };

  constructor(queue: WebhookQueue, router: EventRouter) {
    this.queue = queue;
    this.router = router;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log('Worker started, processing events...');

    while (this.running) {
      try {
        const event = await this.queue.dequeue();

        if (event) {
          await this.processEvent(event);
        } else {
          // No events, brief pause
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error('Worker error:', error);
        this.metrics.errors++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processEvent(event: QueuedEvent): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.router.route({
        id: event.id,
        type: event.eventType,
        timestamp: event.queuedAt.toISOString(),
        data: event.payload,
      });

      if (result.status === 'processed') {
        await this.queue.complete(event.id);
        this.recordSuccess(Date.now() - startTime);
      } else if (result.status === 'error') {
        await this.queue.retry(event);
        this.metrics.retries++;
      }
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      await this.queue.retry(event);
      this.metrics.retries++;
    }
  }

  private recordSuccess(duration: number): void {
    this.metrics.processed++;
    this.metrics.processingTimes.push(duration);

    // Keep only recent samples
    if (this.metrics.processingTimes.length > 1000) {
      this.metrics.processingTimes = this.metrics.processingTimes.slice(-1000);
    }
  }

  stop(): void {
    this.running = false;
  }

  getMetrics(): {
    processed: number;
    errors: number;
    retries: number;
    avgProcessingTime: number;
  } {
    const avgTime = this.metrics.processingTimes.length > 0
      ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length
      : 0;

    return {
      processed: this.metrics.processed,
      errors: this.metrics.errors,
      retries: this.metrics.retries,
      avgProcessingTime: avgTime,
    };
  }
}
```

## Webhook Security Best Practices

Security forms the foundation of any webhook integration. Without proper verification, your endpoints become vulnerable to spoofing attacks and malicious payloads.

### Comprehensive Security Implementation

```typescript
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface SecurityConfig {
  secret: string;
  timestampTolerance: number; // seconds
  enableReplayProtection: boolean;
}

class WebhookSecurity {
  private secret: string;
  private timestampTolerance: number;
  private processedSignatures = new Set<string>();

  constructor(config: SecurityConfig) {
    this.secret = config.secret;
    this.timestampTolerance = config.timestampTolerance;
  }

  verifySignature(payload: Buffer, signature: string): boolean {
    if (!signature) return false;

    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    // Use constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(`sha256=${expected}`),
        Buffer.from(signature)
      );
    } catch {
      return false;
    }
  }

  verifyTimestamp(timestamp: string): boolean {
    try {
      const webhookTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);

      return Math.abs(currentTime - webhookTime) <= this.timestampTolerance;
    } catch {
      return false;
    }
  }

  checkReplay(signature: string): boolean {
    if (this.processedSignatures.has(signature)) {
      return false;
    }

    this.processedSignatures.add(signature);

    // Cleanup old signatures periodically
    if (this.processedSignatures.size > 10000) {
      this.processedSignatures.clear();
    }

    return true;
  }

  validatePayloadStructure(payload: Record<string, any>): boolean {
    const requiredFields = ['type', 'timestamp', 'data'];
    return requiredFields.every(field => field in payload);
  }

  /*
  IMPORTANT DISCLAIMER: Replay Protection for Single-Instance Deployments

  The in-memory Set-based replay protection shown above works only for single-instance
  deployments where all webhook traffic flows through a single server instance.

  For distributed systems with multiple server instances, load balancers, or
  horizontal scaling, the in-memory Set approach WILL NOT WORK because each instance
  maintains its own separate set of processed signatures. An attacker can replay the
  same webhook to different instances, and they will all accept it.

  For production distributed deployments, implement Redis-backed replay cache instead:

  class DistributedWebhookSecurity extends WebhookSecurity {
    private redis: Redis;

    constructor(config: SecurityConfig, redisUrl: string) {
      super(config);
      this.redis = new Redis(redisUrl);
    }

    async checkReplay(signature: string): Promise<boolean> {
      const key = `webhook:replay:${signature}`;
      const exists = await this.redis.exists(key);

      if (exists) {
        return false; // Already processed
      }

      // Mark as processed with expiration (24 hours)
      await this.redis.setex(key, 86400, '1');
      return true;
    }
  }

  The Redis-backed approach ensures that replay detection works correctly across
  all instances in a distributed system, preventing duplicate processing of webhooks.

  Summary:
  - Single instance: In-memory Set (shown above) is fine for development/small deployments
  - Distributed systems: Use Redis-backed cache for production reliability
  - Always use along with timestamp verification to defend against replay attacks
  */
}

// Express middleware for securing webhook endpoints
function createSecureWebhookMiddleware(security: WebhookSecurity) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const payload = (req as any).rawBody as Buffer;
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;

    // Verify signature
    if (!security.verifySignature(payload, signature)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Verify timestamp
    if (!security.verifyTimestamp(timestamp)) {
      res.status(401).json({ error: 'Invalid timestamp' });
      return;
    }

    // Check for replay attack
    if (!security.checkReplay(signature)) {
      res.status(401).json({ error: 'Replay detected' });
      return;
    }

    // Validate payload structure
    const event = req.body;
    if (!security.validatePayloadStructure(event)) {
      res.status(400).json({ error: 'Invalid payload structure' });
      return;
    }

    next();
  };
}

// Usage
const security = new WebhookSecurity({
  secret: process.env.WEBHOOK_SECRET!,
  timestampTolerance: 300, // 5 minutes
  enableReplayProtection: true,
});

app.post('/webhooks/secure',
  createSecureWebhookMiddleware(security),
  async (req: Request, res: Response) => {
    const event = req.body;
    // Process the validated event
    res.status(200).json({ status: 'received' });
  }
);
```

## Common Integration Patterns

Your webhook handlers can integrate with popular platforms and services, using NeuroLink for AI processing. Here are battle-tested patterns for common integrations where you receive webhooks from external services and use NeuroLink to generate intelligent responses.

### Slack Integration

Build a webhook handler that receives Slack events and uses NeuroLink to generate intelligent responses:

```typescript
import { NeuroLink } from '@juspay/neurolink';
import { WebClient } from '@slack/web-api';

class SlackWebhookHandler implements EventHandler {
  private neurolink: NeuroLink;
  private slack: WebClient;

  constructor(neurolink: NeuroLink, slackToken: string) {
    this.neurolink = neurolink;
    this.slack = new WebClient(slackToken);
  }

  canHandle(eventType: string): boolean {
    return eventType.startsWith('slack.');
  }

  async process(event: WebhookEvent): Promise<ProcessingResult> {
    const slackEvent = event.data?.event || {};
    const eventSubtype = slackEvent.type;

    if (eventSubtype === 'message') {
      return await this.handleMessage(slackEvent);
    } else if (eventSubtype === 'app_mention') {
      return await this.handleMention(slackEvent);
    }

    return { status: 'skipped' };
  }

  private async handleMention(event: Record<string, any>): Promise<ProcessingResult> {
    const text = event.text || '';
    const channel = event.channel;
    const threadTs = event.thread_ts || event.ts;

    // Remove bot mention from text
    const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    // Generate AI response
    const response = await this.neurolink.generate({
      input: {
        text: `Respond to this Slack message from a team member: "${cleanText}"

Be helpful, friendly, and concise. If the question relates to code or technical topics, provide specific guidance.`
      },
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 500,
      systemPrompt: 'You are a helpful AI assistant integrated into Slack. Respond in a friendly, professional tone appropriate for workplace communication.',
    });

    // Post response in thread
    await this.slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: response.content,
    });

    return {
      status: 'processed',
      response: response.content,
      actions: [{
        type: 'slack_reply',
        details: { channel, thread_ts: threadTs },
      }],
    };
  }

  private async handleMessage(event: Record<string, any>): Promise<ProcessingResult> {
    // Only process direct messages or messages in specific channels
    const channelType = event.channel_type;

    if (channelType !== 'im') {
      return { status: 'skipped' };
    }

    const text = event.text || '';
    const channel = event.channel;

    const response = await this.neurolink.generate({
      input: { text },
      temperature: 0.8,
      systemPrompt: 'You are a helpful assistant. Provide concise, actionable responses.',
    });

    await this.slack.chat.postMessage({
      channel,
      text: response.content,
    });

    return {
      status: 'processed',
      response: response.content,
    };
  }
}
```

### GitHub Integration

Build a webhook handler that receives GitHub events and uses NeuroLink to automate code review and issue management:

```typescript
import { NeuroLink } from '@juspay/neurolink';
import { Octokit } from '@octokit/rest';

class GitHubWebhookHandler implements EventHandler {
  private neurolink: NeuroLink;
  private octokit: Octokit;

  constructor(neurolink: NeuroLink, githubToken: string) {
    this.neurolink = neurolink;
    this.octokit = new Octokit({ auth: githubToken });
  }

  canHandle(eventType: string): boolean {
    return eventType.startsWith('github.');
  }

  async process(event: WebhookEvent): Promise<ProcessingResult> {
    const githubEvent = event.data?.headers?.['x-github-event'];
    const payload = event.data;

    if (githubEvent === 'pull_request') {
      return await this.handlePullRequest(payload);
    } else if (githubEvent === 'issues') {
      return await this.handleIssue(payload);
    }

    return { status: 'skipped' };
  }

  private async handlePullRequest(payload: Record<string, any>): Promise<ProcessingResult> {
    const action = payload.action;
    const pr = payload.pull_request || {};

    if (action !== 'opened' && action !== 'synchronize') {
      return { status: 'skipped' };
    }

    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;
    const prNumber = pr.number;

    // Get the diff
    const { data: diff } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    });

    // Analyze with NeuroLink
    const review = await this.neurolink.generate({
      input: {
        text: `Review this pull request diff and provide:
1. Summary of changes
2. Potential issues or bugs
3. Code quality suggestions
4. Security considerations

PR Title: ${pr.title}
PR Description: ${pr.body || 'No description provided'}

Diff:
${String(diff).slice(0, 10000)} // Truncate for token limits
`
      },
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 1500,
      systemPrompt: 'You are an expert code reviewer. Provide constructive, actionable feedback focusing on bugs, security, and best practices.',
    });

    // Post review comment
    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      body: review.content,
      event: 'COMMENT',
    });

    // Add labels based on analysis
    const labels = this.determineLabels(review.content);
    if (labels.length > 0) {
      await this.octokit.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels,
      });
    }

    return {
      status: 'processed',
      response: review.content,
      actions: [
        { type: 'github_review', details: { pr_number: prNumber } },
        { type: 'github_labels', details: { labels } },
      ],
    };
  }

  private determineLabels(reviewContent: string): string[] {
    const labels: string[] = [];
    const contentLower = reviewContent.toLowerCase();

    if (contentLower.includes('security')) labels.push('security');
    if (contentLower.includes('bug') || contentLower.includes('issue')) labels.push('needs-review');
    if (contentLower.includes('documentation')) labels.push('documentation');
    if (contentLower.includes('performance')) labels.push('performance');

    return labels;
  }

  private async handleIssue(payload: Record<string, any>): Promise<ProcessingResult> {
    const action = payload.action;
    const issue = payload.issue || {};

    if (action !== 'opened') {
      return { status: 'skipped' };
    }

    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;
    const issueNumber = issue.number;

    // Analyze issue and suggest labels/assignees
    const analysis = await this.neurolink.generate({
      input: {
        text: `Analyze this GitHub issue and provide:
1. Issue category (bug, feature, question, documentation)
2. Priority level (low, medium, high, critical)
3. Suggested labels
4. Initial response to the issue author

Issue Title: ${issue.title}
Issue Body: ${issue.body || 'No description'}
`
      },
      temperature: 0.4,
      systemPrompt: 'You are a project maintainer helping triage GitHub issues.',
    });

    // Add initial response
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `Thank you for opening this issue!\n\n${analysis.content}`,
    });

    return {
      status: 'processed',
      response: analysis.content,
    };
  }
}
```

## Streaming AI Responses in Webhook Handlers

For real-time applications, you can use NeuroLink's streaming capability to progressively deliver AI-generated responses to connected clients. Your webhook handler receives the event, then uses NeuroLink's stream API to generate and forward chunks in real-time:

```typescript
import { NeuroLink } from '@juspay/neurolink';
import { Server as SocketServer } from 'socket.io';

class StreamingWebhookProcessor {
  private neurolink: NeuroLink;
  private io: SocketServer;

  constructor(neurolink: NeuroLink, io: SocketServer) {
    this.neurolink = neurolink;
    this.io = io;
  }

  async processWithStreaming(
    event: WebhookEvent,
    clientId: string
  ): Promise<void> {
    const socket = this.io.to(clientId);

    // Emit start event
    socket.emit('processing:start', { eventId: event.id });

    try {
      // Use NeuroLink streaming for real-time response
      const result = await this.neurolink.stream({
        input: {
          text: `Analyze and respond to this event: ${JSON.stringify(event.data)}`
        },
        provider: 'openai',
        temperature: 0.7,
      });

      let fullContent = '';

      // Stream chunks to client - use 'in' check for discriminated union
      for await (const chunk of result.stream) {
        if ('content' in chunk) {
          fullContent += chunk.content;
          socket.emit('processing:chunk', {
            eventId: event.id,
            chunk: chunk.content,
          });
        }
      }

      // Emit completion
      socket.emit('processing:complete', {
        eventId: event.id,
        content: fullContent,
        usage: result.usage,
      });

    } catch (error) {
      socket.emit('processing:error', {
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
```

## Monitoring and Observability

Production webhook handlers require comprehensive monitoring to ensure reliability and performance. This monitoring infrastructure is built by you alongside your webhook endpoints:

```typescript
interface WebhookMetrics {
  totalReceived: number;
  totalProcessed: number;
  totalFailed: number;
  byEventType: Record<string, number>;
  processingTimes: number[];
  errors: Array<{
    timestamp: string;
    error: string;
    eventType?: string;
    eventId?: string;
  }>;
}

class WebhookMonitor {
  private metrics: WebhookMetrics = {
    totalReceived: 0,
    totalProcessed: 0,
    totalFailed: 0,
    byEventType: {},
    processingTimes: [],
    errors: [],
  };

  private readonly alertThreshold: number;

  constructor(alertThreshold = 0.95) {
    this.alertThreshold = alertThreshold;
  }

  recordReceived(eventType: string): void {
    this.metrics.totalReceived++;
    this.metrics.byEventType[eventType] =
      (this.metrics.byEventType[eventType] || 0) + 1;
  }

  recordProcessed(duration: number): void {
    this.metrics.totalProcessed++;
    this.metrics.processingTimes.push(duration);

    // Keep only recent samples
    if (this.metrics.processingTimes.length > 1000) {
      this.metrics.processingTimes = this.metrics.processingTimes.slice(-1000);
    }
  }

  recordFailed(error: Error, event: WebhookEvent): void {
    this.metrics.totalFailed++;
    this.metrics.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      eventType: event.type,
      eventId: event.id,
    });

    // Keep only recent errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors = this.metrics.errors.slice(-100);
    }
  }

  get successRate(): number {
    if (this.metrics.totalReceived === 0) return 1.0;
    return this.metrics.totalProcessed / this.metrics.totalReceived;
  }

  get averageProcessingTime(): number {
    if (this.metrics.processingTimes.length === 0) return 0;
    return this.metrics.processingTimes.reduce((a, b) => a + b, 0)
      / this.metrics.processingTimes.length;
  }

  get p95ProcessingTime(): number {
    if (this.metrics.processingTimes.length === 0) return 0;
    const sorted = [...this.metrics.processingTimes].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx];
  }

  checkHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; status: string; value: number; threshold: number }>;
  } {
    const health: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      checks: Array<{ name: string; status: string; value: number; threshold: number }>;
    } = {
      status: 'healthy',
      checks: [],
    };

    // Check success rate
    if (this.successRate < this.alertThreshold) {
      health.status = 'degraded';
      health.checks.push({
        name: 'success_rate',
        status: 'warning',
        value: this.successRate,
        threshold: this.alertThreshold,
      });
    }

    // Check processing time
    if (this.p95ProcessingTime > 5000) { // 5 seconds
      health.status = 'degraded';
      health.checks.push({
        name: 'processing_time',
        status: 'warning',
        value: this.p95ProcessingTime,
        threshold: 5000,
      });
    }

    // Check error rate
    const errorRate = this.metrics.totalFailed / Math.max(this.metrics.totalReceived, 1);
    if (errorRate > 0.05) { // 5% error rate
      health.status = 'unhealthy';
      health.checks.push({
        name: 'error_rate',
        status: 'critical',
        value: errorRate,
        threshold: 0.05,
      });
    }

    return health;
  }

  getMetrics(): WebhookMetrics & {
    successRate: number;
    avgProcessingTimeMs: number;
    p95ProcessingTimeMs: number;
  } {
    return {
      ...this.metrics,
      successRate: this.successRate,
      avgProcessingTimeMs: this.averageProcessingTime,
      p95ProcessingTimeMs: this.p95ProcessingTime,
    };
  }
}
```

## What You Built

You built webhook handlers that use NeuroLink for intelligent event processing: secure event validation, asynchronous AI analysis, classification-based routing, and comprehensive monitoring with metrics tracking. Your webhook endpoints now analyze, classify, and respond to incoming events automatically.

As you extend your webhook handlers, keep these principles in mind:

1. **Respond quickly, process asynchronously**: Acknowledge webhooks immediately and queue complex AI processing for background workers
2. **Security is non-negotiable**: Always verify signatures, validate timestamps, and protect against replay attacks
3. **Design for failure**: Implement retry logic, dead letter queues, and comprehensive error handling
4. **Monitor everything**: Track metrics, set up alerts, and maintain visibility into your webhook pipeline's health
5. **Start simple, iterate**: Begin with basic handlers and evolve toward more sophisticated AI-powered workflows as your needs grow

The combination of your webhook infrastructure with NeuroLink's AI capabilities represents a powerful pattern for intelligent event processing. You own and control the webhook endpoints, while NeuroLink handles the AI heavy lifting - allowing you to focus on building the business logic that transforms raw events into meaningful actions and insights.

Start building your webhook handlers with NeuroLink AI processing today, and discover how intelligent event processing can transform your applications.

---

**Related posts:**

- [The Middleware System: Analytics, Guardrails, and Custom Pipelines](/posts/middleware-system/)
- [CLI Automation: Scripting with NeuroLink](/posts/cli-automation/)
- [Error Handling Patterns for AI Applications](/posts/error-handling-patterns/)
