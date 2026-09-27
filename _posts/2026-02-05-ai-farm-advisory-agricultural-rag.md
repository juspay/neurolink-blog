---
layout: post
title: 'AI Farm Advisory: Agricultural Knowledge Bases with RAG'
date: '2026-02-05 10:00:00 +0530'
categories:
  - Use Case
  - Agriculture
tags:
  - agtech
  - agriculture
  - rag
  - knowledge-base
  - offline-ai
  - ollama
  - multi-provider
  - neurolink
author: neurolink
description: >-
  Build an AI farm advisory system with NeuroLink using RAG, offline mode via
  Ollama, and safety guardrails for agronomic advice.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/ai-farm-advisory-agricultural-rag/hero.png
  alt: 'AI Farm Advisory: Agricultural Knowledge Bases with RAG'
---

In this guide, you will build an AI farm advisory system using NeuroLink's RAG capabilities. You will ingest agricultural knowledge bases (crop guides, pest management databases, soil science references), implement semantic search for farming queries, and build a conversational interface that provides localized, crop-specific advice to farmers.

Building an AI farm advisory system presents unique challenges that general-purpose chatbots do not face. Rural connectivity is unreliable, so the system must work offline. Agronomic advice is safety-critical -- recommending the wrong pesticide or application rate can destroy a crop, harm livestock, or contaminate water supplies. The knowledge base spans thousands of crops with regional variations and seasonal factors. And farmers need answers in minutes, not hours.

NeuroLink provides the building blocks for this kind of system: multi-provider orchestration for routing queries to the right model, Ollama integration for offline operation, RAG for grounding answers in verified agricultural data, conversation memory for season-long context, evaluation for advice quality, and middleware guardrails for safety.

This post walks through the complete architecture and implementation of an AI farm advisory system.

## Farm Advisory Architecture

The system uses a connectivity-aware routing architecture. When internet is available, queries are routed to cloud models based on complexity. When offline, a local Ollama model provides answers using a cached knowledge base.

```mermaid
flowchart TB
    Farmer[Farmer<br/>Mobile App] --> Connectivity{Internet<br/>Available?}

    Connectivity -->|Yes| Cloud[Cloud Agents]
    Connectivity -->|No| Local[Local Agent<br/>Ollama LLaMA]

    Cloud --> Router[Query Router<br/>Task Classifier]
    Router -->|Quick Lookup| Fast[Fast Agent<br/>Gemini Flash<br/>Planting dates, specs]
    Router -->|Diagnosis| Expert[Expert Agent<br/>Claude Opus via Bedrock<br/>Disease ID, treatment]
    Router -->|Weather| Weather[Weather Agent<br/>GPT-5.4 plus Tools<br/>Forecast integration]

    Fast --> KB[Agricultural KB<br/>RAG Vector Search]
    Expert --> KB
    Local --> LocalKB[Local KB Cache<br/>Embedded Vectors]

    Expert --> Eval[Quality Evaluation]
    Eval -->|Safety Critical| Guard[Safety Guardrails<br/>Pesticide Limits]
    Guard --> Memory[Season Memory<br/>Conversation History]
    Memory --> Response[Farmer Response]
```

The architecture has three key design decisions:

1. **Query routing by complexity**: Simple lookups (planting dates, crop specs) go to fast, cheap models. Diagnostic questions (disease identification, treatment plans) go to expert models. Weather-dependent advice uses tool-calling models that integrate with weather APIs.

2. **Offline fallback**: When the farmer has no internet connection, the system seamlessly falls back to a local Ollama model running on the device or a local edge server. The local model has access to a cached subset of the knowledge base.

3. **Safety-first pipeline**: All diagnostic advice passes through quality evaluation and safety guardrails before reaching the farmer. Banned pesticides are filtered, unsafe dosage recommendations are blocked, and low-confidence diagnoses include referrals to local extension offices.

## Multi-Provider Setup with Offline Fallback

The system uses current provider/model pairs for each route. One `NeuroLink` instance can dispatch all four:

```typescript
import { NeuroLink } from "@juspay/neurolink";

const neurolink = new NeuroLink({
  credentials: {
    bedrock: {
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    openai: { apiKey: process.env.OPENAI_API_KEY },
    googleAiStudio: { apiKey: process.env.GOOGLE_AI_API_KEY },
  },
});

const agents = {
  lookup: { provider: "google-ai", model: "gemini-2.5-flash" },
  expert: { provider: "bedrock", model: "anthropic.claude-opus-4-6-v1" },
  weather: { provider: "openai", model: "gpt-5.4" },
  offline: { provider: "ollama", model: "llama3.1:8b" },
} as const;

async function generateWithAgent(
  agent: keyof typeof agents,
  text: string,
) {
  return neurolink.generate({ input: { text }, ...agents[agent] });
}
```

The Ollama provider is suited to deployments that must continue without a cloud connection:

- **No API keys required**: `requiredEnvVars: []` -- no cloud credentials needed on the device
- **Zero marginal cost**: `defaultCost: { input: 0, output: 0 }` -- free local inference after hardware setup
- **Tool-capable models**: Models like `llama3.1`, `mistral`, `hermes3`, and `qwen2.5` support basic tool calling even offline
- **Local operation**: Runs on `http://localhost:11434` with no internet dependency

> **Note:** For offline operation, pre-download the Ollama model and knowledge base vectors to the device before the farmer enters a connectivity dead zone. The `llama3.1:8b` model requires approximately 4.7GB of disk space.
{: .prompt-info }

### Connectivity-Aware Routing

The routing logic detects connectivity and classifies queries to determine the best agent:

```typescript
// Connectivity-aware routing
async function getAdvisory(query: string, hasInternet: boolean) {
  if (!hasInternet) {
    return generateWithAgent(
      "offline",
      `${localKBContext}\n\nFarmer question: ${query}`,
    );
  }

  // Online: route by query type
  const queryType = classifyQuery(query);
  switch (queryType) {
    case "fast": return generateWithAgent("lookup", query);
    case "diagnostic": return generateWithAgent("expert", query);
    case "weather": return generateWithAgent("weather", query);
  }
}
```

Query classification uses pattern matching based on NeuroLink's task classification configuration:

- **Fast patterns** (simple lookups): `"What is...?"`, `"When should I...?"`, `"How much...?"` -- these match planting dates, crop specifications, and dosage tables
- **Reasoning patterns** (diagnostic queries): `"analyze"`, `"compare"`, `"evaluate"`, `"diagnose"` -- these require expert-level reasoning about symptoms, soil conditions, or treatment options
- **Weather patterns**: queries mentioning forecast, rain, frost, irrigation, or planting timing

## Agricultural RAG Knowledge Base

The RAG (Retrieval-Augmented Generation) pattern grounds AI responses in verified agricultural data rather than relying on the model's training data. This is critical for farming advice because:

- Crop management practices vary by region and microclimate
- Pesticide regulations change frequently
- New disease strains require updated treatment protocols
- Local soil conditions affect fertilizer recommendations

```typescript
// RAG pattern: retrieve relevant agricultural knowledge, inject as context

async function queryWithRAG(
  question: string,
  agent: keyof typeof agents,
) {
  // 1. Retrieve relevant documents from vector search
  const relevantDocs = await vectorSearch(question, {
    collections: ["crop-guides", "pest-database", "soil-maps", "extension-bulletins"],
    topK: 5,
    minScore: 0.7,
  });

  // 2. Build context from retrieved documents
  const context = relevantDocs
    .map(doc => `[Source: ${doc.source}]\n${doc.content}`)
    .join("\n\n");

  // 3. Generate response with RAG context
  const systemPrompt = `You are an agricultural advisor.
Use ONLY the provided knowledge base context to answer.
If the answer is not in the context, say so.
Always include source references.

Knowledge Base Context:
${context}`;

  return generateWithAgent(
    agent,
    `${systemPrompt}\n\nFarmer question: ${question}`,
  );
}
```

### Knowledge Base Collections

The agricultural knowledge base is organized into four collections:

| Collection | Content | Sources | Update Frequency |
|---|---|---|---|
| `crop-guides` | Planting calendars, growing requirements, harvest timing | USDA, state extension services | Annually |
| `pest-database` | Pest identification, life cycles, treatment options | IPM databases, entomology research | Quarterly |
| `soil-maps` | Soil types, nutrient profiles, amendment recommendations | NRCS surveys, soil testing labs | As tested |
| `extension-bulletins` | Regional advisories, disease alerts, weather impacts | County extension offices | Weekly during season |

### Local Knowledge Base Cache

For offline operation, a subset of the knowledge base is cached locally with embedded vectors:

```typescript
// Pre-cache knowledge base for offline use
async function cacheLocalKB(farmLocation: string, crops: string[]) {
  const relevantDocs = await vectorSearch(
    `farming ${crops.join(', ')} in ${farmLocation}`,
    {
      collections: ['crop-guides', 'pest-database'],
      topK: 100,   // Cache top 100 most relevant documents
      minScore: 0.5,
    }
  );

  // Store locally with embedded vectors
  await localVectorStore.upsert(relevantDocs);
  console.log(`Cached ${relevantDocs.length} documents for offline use`);
}
```

The local cache is refreshed whenever the farmer has connectivity. Priority is given to documents relevant to the farmer's specific crops, location, and current growing season.

## Weather and Sensor Tool Integration

Modern farming benefits from real-time data integration. NeuroLink can connect to weather and sensor MCP servers configured through the CLI:

```bash
neurolink mcp add weather-service node --args ./servers/weather.js
neurolink mcp add soil-sensors node --args ./servers/soil-sensors.js
neurolink mcp list --status
```

For an application-local weather integration, define a typed tool and pass it to `generate()`:

```typescript
import { tool } from "ai";
import { z } from "zod";

const getWeatherForecast = tool({
  description: "Get weather forecast for farm location",
  parameters: z.object({
    latitude: z.number(),
    longitude: z.number(),
    days: z.number().min(1).max(14),
  }),
  execute: async ({ latitude, longitude, days }) => {
    const forecast = await weatherAPI.getForecast(latitude, longitude, days);
    return {
      location: { lat: latitude, lon: longitude },
      forecast: forecast.daily.map(day => ({
        date: day.date,
        tempHigh: day.tempMax,
        tempLow: day.tempMin,
        precipitation: day.precipMm,
        humidity: day.humidityAvg,
        windSpeed: day.windSpeedMax,
        frostRisk: day.tempMin < 2,
      })),
    };
  },
});
```

The weather tool enables forecast-aware advice. When a farmer asks whether to apply a fungicide, the agent can retrieve the forecast and the application can compare it with the product label and local guidance. The language model should not invent a spray interval or override label requirements.

### Soil Sensor Integration

IoT soil sensors provide real-time field conditions for precision recommendations:

```typescript
const getSoilMoisture = tool({
  description: "Get soil moisture readings from field sensors",
  parameters: z.object({
    fieldId: z.string().describe("Field identifier"),
    depth: z.enum(["surface", "root-zone", "deep"]),
  }),
  execute: async ({ fieldId, depth }) => {
    const reading = await sensorAPI.getMoisture(fieldId, depth);
    return {
      fieldId, depth,
      moisture: reading.percentage,
      status: reading.percentage < 20 ? "dry" : reading.percentage > 80 ? "wet" : "optimal",
      lastUpdated: reading.timestamp,
    };
  },
});
```

With soil-moisture data, the agent can explain current field conditions and retrieve the applicable irrigation guidance. Any numerical recommendation should come from a validated agronomic calculation that accounts for the crop, growth stage, soil, sensor calibration, weather, and local practice -- not from the language model alone.

## Safety Guardrails for Agronomic Advice

Agricultural AI must never recommend banned substances, unsafe application rates, or practices that could harm people, animals, or the environment. NeuroLink's middleware guardrails enforce these constraints:

```typescript
const safeResult = await neurolink.generate({
  input: { text: advisoryPrompt },
  provider: "anthropic",
  model: "claude-opus-5",
  middleware: {
    middlewareConfig: {
      guardrails: {
        enabled: true,
        config: {
          badWords: {
            enabled: true,
            list: [
              // Illustrative only: production systems must query current,
              // location-specific product registrations and labels.
              "ddt", "paraquat", "chlorpyrifos", "endosulfan", "lindane",
              "aldrin", "dieldrin", "heptachlor", "toxaphene", "mirex",
              "unlimited", "as much as possible", "no limit",
            ],
          },
          precallEvaluation: {
            enabled: true,
            blockUnsafeRequests: true,
          },
        },
      },
      analytics: { enabled: true },
    },
  },
});
```

The safety system operates at three levels:

1. **Keyword filtering (`badWords`)**: Blocks responses that mention banned pesticides like DDT, paraquat, or chlorpyrifos, as well as dangerous language like "unlimited" dosage
2. **Pre-call evaluation (`precallEvaluation`)**: Screens incoming queries to block attempts to bypass safety guidelines
3. **Post-generation validation**: Validate the structured recommendation against current labels, registrations, dosage limits, weather constraints, and local rules before displaying it

> **Critical:** The pesticide ban list above is a minimal example. Real agricultural advisory systems must integrate with authoritative databases (EPA's Pesticide Product Label System, EU Pesticide Database, or local agricultural extension databases) for comprehensive banned substance checking. Brand names, chemical synonyms, and combination products require specialized lookup — keyword filtering alone is insufficient for chemical safety. Always direct users to consult licensed agronomists and official agricultural extension offices before applying any pesticide.
{: .prompt-danger }

## Growing Season Memory

Farming is inherently longitudinal. A conversation in April about planting decisions affects pest management advice in July and harvest timing in October. NeuroLink's conversation memory tracks the full growing season:

```typescript
// Season-long conversation context
process.env.NEUROLINK_MEMORY_ENABLED = "true";
process.env.NEUROLINK_MEMORY_MAX_SESSIONS = "1000";
process.env.NEUROLINK_SUMMARIZATION_ENABLED = "true";
process.env.NEUROLINK_TOKEN_THRESHOLD = "80000";

const seasonPrompt = `You are an agricultural advisor for ${farmName}.
Crops: ${currentCrops.join(", ")}
Location: ${farmLocation}
Soil type: ${soilType}
Growing zone: ${growingZone}
Season stage: ${currentSeasonStage}

You are continuing an ongoing conversation. Previous messages contain
important context including projects, tasks, and topics discussed previously.

Reference previous conversations about this farm when relevant.
Track treatments applied, issues diagnosed, and recommendations given.`;
```

With season memory, the AI knows that:

- The farmer planted Roma tomatoes on March 15th
- A calcium deficiency was diagnosed and amended in April
- Fungicide was applied twice in June
- Blossom end rot was reported in early July (possibly related to the earlier calcium issue)

This context transforms generic advice into farm-specific guidance. Instead of "blossom end rot is often caused by calcium deficiency," the AI can say "Given the calcium deficiency we addressed in April and the inconsistent irrigation pattern from your sensor data, this blossom end rot is likely related to calcium uptake being impaired by moisture stress. Consider more consistent irrigation rather than additional calcium amendment."

## Quality Evaluation for Farm Recommendations

Not all agricultural advice carries the same risk. A planting date recommendation is low-stakes -- the farmer loses a few days if the advice is wrong. A pesticide application recommendation is high-stakes -- the wrong advice can destroy a crop or contaminate a water source.

```typescript
const adviceEval = await neurolink.evaluate(
  {
    query: "My tomatoes have yellow leaves with dark spots. What should I do?",
    response: diagnosticResponse,
    context: [
      JSON.stringify(moistureData),
      JSON.stringify(weatherData),
      ...seasonHistory,
    ],
  },
  {
    scorers: ["faithfulness", "answer-relevancy", "hallucination"],
    passThreshold: 0.75,
  },
);

if (!adviceEval.passed) {
  diagnosticResponse +=
    "\n\nPlease consult your local agricultural extension office to confirm this diagnosis.";
}
```

The evaluation checks:

- **Faithfulness**: Is the response supported by the supplied context?
- **Answer relevancy**: Does the recommendation address the specific question?
- **Hallucination**: Does the response introduce unsupported claims?

Lower-confidence responses automatically include a referral to the local agricultural extension office. The AI assists but does not replace expert human judgment for critical decisions.

## Resilience for Rural Connectivity

Rural internet connections are unreliable. NeuroLink's circuit breaker pattern ensures fast fallback to offline mode rather than long timeouts:

```typescript
import { CircuitBreakerManager, withRetry } from "@juspay/neurolink";

const cloudBreaker = new CircuitBreakerManager().getBreaker("farm-cloud", {
  failureThreshold: 2,
  resetTimeout: 10000,
  operationTimeout: 15000,
});

async function getAdvisoryResilient(query: string) {
  try {
    return await cloudBreaker.execute(() =>
      withRetry(
        () => generateWithAgent("expert", query),
        { maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 5000 }
      )
    );
  } catch {
    // Offline fallback
    return generateWithAgent("offline", `${localKBContext}\n\n${query}`);
  }
}
```

Key design decisions for rural resilience:

- **Low failure threshold (2)**: After just 2 failed cloud requests, the circuit breaker trips and routes all subsequent requests to the offline agent. Farmers cannot wait through multiple timeout cycles.
- **Short reset timeout (10 seconds)**: The circuit breaker tries the cloud again quickly when connectivity returns, so the farmer gets the best available response as soon as the connection is restored.
- **Graceful degradation**: Offline responses are lower quality (smaller model, cached knowledge base) but usable. A partial answer from the local model is better than a timeout error.

## Cost Analysis

Farm-advisory costs depend on current provider prices, token usage, retrieval infrastructure, connectivity, hardware, and the human review required for safety-critical guidance. Build the estimate from measured usage rather than a fixed per-question claim:

| Component | Measure |
|---|---|
| Cloud generation | Input/output tokens by provider and model |
| Retrieval | Embedding, vector-store, and document-refresh costs |
| Offline inference | Device purchase, power, storage, and maintenance |
| Safety controls | Product-database access, validation, and human review |
| Operations | Monitoring, support, and model/knowledge-base updates |

Log `result.usage` and the selected model, apply a versioned provider price table, and compare the result with observed agronomic outcomes. Do not treat low inference cost as evidence that advice is safe or economically beneficial.

## What's Next

You have completed all the steps in this guide. To continue building on what you have learned:

1. Review the code examples and adapt them for your specific use case
2. Start with the simplest pattern first and add complexity as your requirements grow
3. Monitor performance metrics to validate that each change improves your system
4. Consult the NeuroLink documentation for advanced configuration options

---

**Related posts:**

- [Building RAG Applications with NeuroLink SDK](/posts/rag-implementation/)
- [Advanced RAG: 10 Chunking Strategies, Hybrid Search, and Reranking](/posts/advanced-rag/)
- [AI-Powered Maintenance Knowledge Base for Manufacturing](/posts/ai-maintenance-knowledge-base-manufacturing/)
