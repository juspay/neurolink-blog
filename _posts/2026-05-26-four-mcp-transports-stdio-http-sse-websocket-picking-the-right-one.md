---
layout: post
title: 'Four MCP transports: stdio, http, sse, websocket — picking the right one'
date: '2026-05-26 10:00:00 +0530'
categories:
  - Tutorial
tags:
  - neurolink
author: neurolink
description: >-
  Four MCP transports: stdio, http, sse, websocket — picking the right one — companion deep-dive for the NeuroLink blog with architectural detail and code examples.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/four-mcp-transports-stdio-http-sse-websocket-picking-the-right-one/hero.png
  alt: 'Four MCP transports: stdio, http, sse, websocket — picking the right one'
---
We built the first NeuroLink MCP server manager to run external tools as subprocesses, communicating over `stdio`. It was simple, self-contained, and it worked perfectly for tools that were packaged with the main application. Then we deployed a new tool at Juspay, a Python-based document analyzer running in its own Docker container. The `stdio` transport failed instantly. The parent NeuroLink process couldn't spawn a process inside a separate container, and even if it could, we had no way to monitor the tool's health, manage its lifecycle, or scale it independently. That failure forced us to decouple the tool from the agent, leading to the four-transport architecture MCP uses today: `stdio` for simple cases, and HTTP, Server-Sent Events (SSE), and WebSockets for robust, networked tool execution.

## The Problem with Tight Coupling

The original MCP transport, `stdio`, treats a tool like a command-line utility. When you register a server with this transport, the `ExternalServerManager` spawns the tool's process and attaches to its `stdin`, `stdout`, and `stderr` streams.

This is a valid approach for simple, co-located tools. For example, a small Node.js script that lives on the same machine as the NeuroLink agent.

```typescript
// Example: a local stdio server (type MCPServerInfo)

const localScriptServer: MCPServerInfo = {
  id: 'local-script-server',
  name: 'Local Script Server',
  transport: 'stdio',
  command: 'node',
  args: ['./tools/my-local-script.js', '--mcp'],
  // ... status, tools, and other fields
};
```

The problem is that this creates a rigid parent-child relationship.

- **Lifecycle Coupling:** If the NeuroLink agent restarts, the tool process is killed. If the tool process crashes, the agent might not have a clean way to restart it or understand why it failed. This is a classic cascading failure scenario we try to avoid, as discussed in our post on the [MCP Circuit Breaker pattern](/posts/mcp-circuit-breaker-pattern/). The `ExternalServerManager`, located in `src/lib/mcp/externalServerManager.ts`, has to contain complex logic just to handle unexpected process exits and prevent zombie processes, which is a significant overhead for what should be a simple transport.

- **No Network Visibility:** The tool isn't on the network. You can't hit it with `curl`, you can't put a load balancer in front of it, and you can't easily run it in a separate container managed by Kubernetes or another orchestrator. This also means you can't have multiple agents share a single instance of a resource-intensive tool.

- **Debugging Hell:** When something goes wrong, you're limited to parsing text from `stderr`. There's no structured error format, no HTTP status codes, and no easy way to inspect the state of the tool server. Is the tool hanging, or is it just slow? Is it consuming too much memory? With `stdio`, you're flying blind. This puts an enormous burden on developers to write tools that are perfectly behaved and produce easily parsable error messages.

## HTTP: Stateless, Scalable, and Standard

To solve the containerization problem we saw at Juspay, we introduced the HTTP transport. An MCP server using the `http` transport is just a standard web server that exposes a specific endpoint for tool calls.

NeuroLink's `ExternalServerManager` doesn't spawn this process. It simply needs to know the URL.

```typescript
// Example: a remote HTTP server (type MCPServerInfo)

const remoteHttpServer: MCPServerInfo = {
  id: 'document-analyzer-prod',
  name: 'Production Document Analyzer',
  transport: 'http',
  url: 'https://tools.juspay.in/document-analyzer',
  // headers / auth are top-level fields (see below)
};
```

This immediately solves the problems with `stdio`:

- **Decoupled Lifecycle:** The tool server is a completely independent service. It can be deployed, scaled, and updated without affecting the NeuroLink agent that calls it.
- **Network Native:** It's on the network. This means you can use standard infrastructure for load balancing, health checks, and security.
- **Observability:** Every tool call is an HTTP request. This makes it trivial to integrate with standard monitoring and tracing tools. You can see every request, its latency, and its status code, which is critical for maintaining quality. Our entire philosophy around [OpenTelemetry for AI](/posts/opentelemetry-ai-observability/) relies on this kind of visibility.

The tradeoff is the stateless nature of HTTP. Every `executeTool` call is a new, independent request. For tools that require a continuous, stateful conversation, the overhead of establishing a new HTTP connection for every message can be inefficient.

## Authentication Across Transports

Moving from a trusted, local `stdio` process to a networked HTTP or WebSocket server introduces a critical new problem: security. A tool server exposed on the network is a potential vulnerability. It needs to know who is calling it and whether they are authorized.

The `stdio` transport has no concept of authentication; the trust is implicit because the agent process is the parent of the tool process. For networked transports, we explicitly provide configuration for this in `MCPServerInfo`.

The top-level `headers` field on the server config is the key. It lets you specify headers sent with every request — most commonly an API key or a bearer token. (A dedicated `auth` field handles the common token cases for you.)

```typescript
// Example: an authenticated HTTP server (type MCPServerInfo)

const secureHttpServer: MCPServerInfo = {
  id: 'secure-internal-tool',
  name: 'Secure Internal Tool',
  transport: 'http',
  url: 'https://tools.internal/secure-tool/execute',
  headers: {
    'Authorization': 'Bearer super-secret-token-from-env',
    'X-Request-Source': 'neurolink-mcp'
  },
  // or use the dedicated auth field: auth: { type: 'bearer', token: '...' }
};
```

For WebSockets, authentication is handled similarly during the initial HTTP `Upgrade` request. The same headers can be passed to verify the client's identity before the protocol switch occurs. This ensures that only trusted NeuroLink agents can connect to and execute your tools, preventing unauthorized access.

## SSE and WebSockets: For Streaming and Conversations

While HTTP is the workhorse for most tool calls, some tools need a more persistent connection.

- **Server-Sent Events (SSE):** For when a tool needs to stream updates *to* the agent. Think of a long-running task like code generation or a data analysis job. The tool can push progress events, logs, or partial results over a single, long-lived connection. The agent listens, but it can't easily talk back. This is a one-way firehose of data from the tool to the agent.

- **WebSockets:** For when you need a true two-way conversation. The connection is persistent and full-duplex. This is ideal for highly interactive tools, like a "clarification agent" that asks follow-up questions before executing a task — the kind of elicitation the `ElicitationProtocolHandler` coordinates (it works over any transport, not just WebSockets). In this model, the `executeTool` can maintain context across multiple message exchanges, which is impossible with stateless HTTP and cumbersome with `stdio`.

The configuration in `MCPServerInfo` remains simple. You just declare the transport type and the endpoint.

```typescript
// Example: SSE and WebSocket servers (type MCPServerInfo)

const streamingReportServer: MCPServerInfo = {
  id: 'streaming-reporter',
  name: 'Streaming Reporter',
  transport: 'sse',
  url: 'https://tools.juspay.in/reports/stream',
};

const conversationalAgentServer: MCPServerInfo = {
  id: 'clarification-agent',
  name: 'Clarification Agent',
  transport: 'websocket',
  url: 'wss://tools.juspay.in/clarify-agent',
};
```

## The Factory Pattern: Unifying Transport Clients

With four different transport types, how does the `ExternalServerManager` avoid becoming a tangled mess of conditional logic? The answer is a classic software design pattern: the factory.

Inside `src/lib/mcp/mcpClientFactory.ts`, we keep a `MCPClientFactory` class that exposes a static `createClient` method. The `ExternalServerManager` does not know how to speak HTTP, open a WebSocket, or manage `stdio` pipes. It performs a single action: it hands an `MCPServerInfo` to the factory, and gets back a connected client with the matching transport already wired up.

```typescript
// src/lib/mcp/mcpClientFactory.ts (shape)

export class MCPClientFactory {
  static async createClient(
    config: MCPServerInfo,
    timeout = DEFAULT_CLIENT_TIMEOUT,
  ): Promise<MCPClientResult> {
    // dispatch on config.transport (a plain string):
    //   "stdio"     → spawn a child process, wire stdin/stdout
    //   "http"      → open an HTTP client against config.url
    //   "sse"       → attach an SSE listener for server → client streaming
    //   "websocket" → open a full-duplex WebSocket
    // returns: { client, capabilities, transport } on success
    //          { error } on failure (no exception thrown into the caller)
  }
}
```

The factory returns an object that conforms to a common interface, abstracting away the connection details. Adding a new transport in the future — gRPC, QUIC, or something proprietary — does not require touching the `ExternalServerManager`. The new transport class slots into the same dispatch and the rest of the system keeps working unchanged.

## Common Failure Modes

Decoupling introduces new failure modes, most of which are network-related. The `ExternalServerManager`, by consuming clients from `MCPClientFactory.createClient`, is also responsible for handling their distinct failures.

- **`stdio` Failures:** The most common issues are process-related. The command in `MCPServerInfo` might point to a non-existent binary (`ENOENT`), or the file might not have execute permissions (`EACCES`). If the process starts but then immediately exits with a non-zero status code, `ExternalServerManager` in `src/lib/mcp/externalServerManager.ts` must capture `stderr` to provide a meaningful error message.

- **`http` Failures:** These are standard network errors. The DNS name for the endpoint might not resolve. The server might be down, refusing the connection. It could return a 503 Service Unavailable, indicating a temporary overload, which might warrant a retry. Or it could return a 401 Unauthorized, indicating a problem with the auth token. The client must interpret these HTTP status codes correctly.

- **`sse` / `websocket` Failures:** These stateful connections can fail at any time. A network hiccup can sever the connection mid-stream. The `WebSocketClient` needs a robust reconnection strategy, likely with exponential backoff, to avoid overwhelming a recovering server. It also needs to handle the case where a message is sent while the connection is down. Does it queue the message, or does it fail the `executeTool` call immediately? The answer depends on the tool's requirements for guaranteed delivery.

Here's a visual breakdown of how these transports relate the NeuroLink agent to the tool server:

```mermaid
graph TD
    subgraph NeuroLink Agent
        A[ExternalServerManager]
    end

    subgraph "Transport Layer"
        T_STDIO[stdio]
        T_HTTP[http]
        T_SSE[sse]
        T_WS[websocket]
    end
    
    subgraph Tool Servers
        S_STDIO(Tool as Child Process)
        S_HTTP(Tool as HTTP Server)
        S_SSE(Tool as SSE Server)
        S_WS(Tool as WebSocket Server)
    end

    A -- "spawn(), pipe" --> T_STDIO -- "stdin/stdout" --> S_STDIO
    A -- "POST /execute" --> T_HTTP --- S_HTTP
    A -- "GET /stream" --> T_SSE -- "event-stream" --> A
    A -- "Upgrade: websocket" <--> T_WS <--> S_WS
```

## Configuration at a Glance

Every server is declared the same way — an `MCPServerInfo` carrying a `transport` string plus the fields that transport needs (`command` for `stdio`, `url` for the network transports). The trade-offs each one carries are what should drive the choice:

| Transport | `transport` value | Direction | Connection | Best for | Primary failure mode |
|-----------|-------------------|-----------|------------|----------|----------------------|
| stdio | `'stdio'` | bidirectional pipe | per-process, local | local scripts bundled with the agent | `ENOENT` / `EACCES` / non-zero exit |
| HTTP | `'http'` | request / response | stateless | remote, single-call tools | DNS failure, 503, 401 |
| SSE | `'sse'` | server → client | long-lived, one-way | streaming progress and partial results | mid-stream disconnect |
| WebSocket | `'websocket'` | full-duplex | persistent | conversational, multi-turn tools | disconnect needing backoff reconnect |

The `MCPClientFactory` reads that single `transport` string and hands back a ready client, so moving a tool from `http` to `websocket` is a one-line config change — the `ExternalServerManager` and your `executeTool` calls stay exactly the same.

## Picking the Right Transport

There's no single "best" transport; the right choice depends entirely on the tool's architecture and how it needs to communicate.

- **`stdio`**: Use this for simple, local scripts that are packaged directly with your agent. It's great for development or for tools you control completely in a monolithic environment. The lack of network configuration makes it the fastest way to get started. It's often sufficient for the kinds of validation scripts you might run in a CI pipeline, like those described in our post on [GitHub Actions for AI](/posts/github-actions-ai-cicd/).

- **`http`**: This is your default for any tool that runs as a separate service. It's robust, scalable, and easy to manage with standard cloud infrastructure. If your tool can perform its function in a single, stateless call, HTTP is the right choice. Its ubiquity means you have a vast ecosystem of proxies, load balancers, and monitoring tools at your disposal.

- **`sse`**: Choose SSE when your tool performs a long-running, read-only operation and you want to provide progress updates to the user or agent. It's a one-way street from the server to the client. This is perfect for streaming back log messages, status updates, or chunks of a large response as they become available.

- **`websocket`**: Reserve WebSockets for tools that are truly conversational. If the tool needs to ask questions, get clarifications, or have a low-latency, back-and-forth exchange with the agent, the full-duplex nature of WebSockets is what you need. This is the most powerful but also the most complex transport to manage.

By supporting all four, NeuroLink's MCP allows you to `executeTool` against any kind of tool, from a local script to a globally distributed service, without changing your application-level code. You just point the `ExternalServerManager` at a new `MCPServerInfo`, and it handles the rest.

---

---

**Related posts:**

- [MCP Circuit Breaker: Preventing Cascading Failures in AI Tool Calls](/posts/mcp-circuit-breaker-pattern/)
- [OpenTelemetry for AI: Tracing Every Token Through Your Pipeline](/posts/opentelemetry-ai-observability/)
- [GitHub Actions for AI: Automating NeuroLink in Your CI/CD Pipeline](/posts/github-actions-ai-cicd/)
