---
layout: post
title: 'Video Generation with Veo 3.1: AI-Powered Video Synthesis'
date: '2026-02-02 10:00:00 +0530'
categories:
  - Tutorial
  - Multimodal
tags:
  - video-generation
  - veo
  - multimodal
  - ai-video
  - vertex-ai
  - neurolink
author: neurolink
description: >-
  Generate videos from text prompts using NeuroLink and Google Veo 3.1. Control
  duration, aspect ratio, and build automated video content pipelines in
  TypeScript.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/video-generation-veo/hero.png
  alt: 'Video Generation with Veo 3.1: AI-Powered Video Synthesis'
---

> **Warning:** The video generation APIs shown in this post are based on preview/early-access documentation and may change before general availability. Verify current API availability and parameters with your provider's documentation.
{: .prompt-warning }

In this guide, you will generate videos using Veo 3.1 through NeuroLink's unified API. You will configure video generation parameters, implement prompt engineering for video content, handle long-running generation workflows, and build a pipeline that combines text generation with video synthesis.

Video generation is the newest frontier in generative AI, and the use cases are already tangible: product demos without hiring a videographer, marketing content without a production budget, social media clips without an editing suite, educational videos without a studio. The technology is still evolving, and output quality varies by prompt, reference image, and provider, so review generated clips before publishing them.

In this tutorial, you will learn how to animate reference images with text prompts, configure duration and aspect ratio for different platforms, handle the long-running generation workflow, and build a complete social media video pipeline.

## Architecture: How Video Generation Works

The critical difference between video generation and text or image generation is that video generation is inherently asynchronous. Generating a short video clip can take from tens of seconds to several minutes, depending on the provider, prompt, duration, and resolution.

```mermaid
flowchart TB
    subgraph Input["Input Options"]
        TEXT["Text Prompt"]
        IMG["Reference Image<br/>(required)"]
        CFG["Configuration<br/>duration, resolution"]
    end

    subgraph NeuroLink["NeuroLink SDK"]
        VGEN["Video Generation Service"]
        POLL["Async Polling<br/>(long-running operation)"]
    end

    subgraph Provider["Provider"]
        VEO["Google Veo 3.1<br/>via Vertex AI"]
    end

    subgraph Output["Output"]
        VIDEO["Generated Video<br/>MP4"]
        THUMB["Thumbnail"]
        META["Metadata<br/>duration, resolution, fps"]
    end

    TEXT --> VGEN
    IMG --> VGEN
    CFG --> VGEN
    VGEN --> VEO
    VEO -->|"Long-running operation"| POLL
    POLL --> VIDEO & THUMB & META

    style TEXT fill:#3b82f6,stroke:#2563eb,color:#fff
    style VGEN fill:#6366f1,stroke:#4f46e5,color:#fff
    style VEO fill:#f59e0b,stroke:#d97706,color:#fff
    style POLL fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style VIDEO fill:#22c55e,stroke:#16a34a,color:#fff
```

NeuroLink handles the polling internally. When you call `generate()` with a video output mode, the SDK submits the generation request to Veo 3.1 via Vertex AI, then polls for completion, and returns the finished video once it is ready. Your code awaits a single promise -- the async complexity is hidden.

## Basic Video Generation

Generating a video uses the same `generate()` method with the output mode set to `"video"` and one reference image in `input.images`:

```typescript
import { NeuroLink } from '@juspay/neurolink';

const neurolink = new NeuroLink();

// Veo video mode currently requires an input image
const fs = await import('fs/promises');
const referenceImage = await fs.readFile('mountain-lake.png');

const result = await neurolink.generate({
  input: {
    text: 'A serene mountain lake at sunrise, mist rising from the water, cinematic quality, slow camera pan',
    images: [referenceImage],
  },
  provider: 'vertex',
  model: 'veo-3.1-generate-001',
  output: {
    mode: 'video',
    video: {
      aspectRatio: '16:9',
      length: 6,
    },
  },
});

// Save the video
if (result.video) {
  await fs.writeFile('mountain-lake.mp4', result.video.data);

  console.log('Video generated:');
  console.log('  Duration:', result.video.metadata?.duration, 'seconds');
  console.log('  Dimensions:', result.video.metadata?.dimensions);
  console.log('  Format:', result.video.mediaType);
}
```

The result object includes a `video` property containing the raw video `Buffer`, its `mediaType`, and optional metadata such as duration and pixel dimensions.

> **Note:** Video generation can take 30 seconds to several minutes depending on duration and complexity. Plan your application's UX accordingly -- display a loading state, use background job processing, or notify the user when the video is ready.
{: .prompt-info }

## Video Generation from Reference Images

One of the most powerful features is image-to-video generation. Provide a static image and describe how it should animate:

```typescript
// Generate video from a static image (image-to-video)
const fs = await import('fs/promises');
const referenceImage = await fs.readFile('product-photo.png');

const result = await neurolink.generate({
  input: {
    text: 'Slowly rotate the product 360 degrees with soft studio lighting, smooth animation',
    images: [referenceImage],
  },
  provider: 'vertex',
  model: 'veo-3.1-generate-001',
  output: {
    mode: 'video',
    video: {
      aspectRatio: '9:16',
      length: 4,
    },
  },
});

if (result.video) {
  await fs.writeFile('product-rotation.mp4', result.video.data);
}
```

This is transformative for e-commerce: take your existing product photography and generate spinning product videos, lifestyle context videos, or animated feature highlights without a video production setup.

## Configuration Options

### Duration and Aspect Ratio

Different platforms and use cases demand different video specifications:

```typescript
const fs = await import('fs/promises');
const abstractReferenceImage = await fs.readFile('abstract-particles.png');
const officeReferenceImage = await fs.readFile('office-desk.png');

// Short clip (4 seconds) - social media
const shortClip = await neurolink.generate({
  input: {
    text: 'Colorful abstract particles flowing and merging',
    images: [abstractReferenceImage],
  },
  provider: 'vertex',
  model: 'veo-3.1-generate-001',
  output: {
    mode: 'video',
    video: {
      aspectRatio: '9:16',  // Vertical for TikTok/Reels
      length: 4,
    },
  },
});

// Longer clip (6-8 seconds) - product demo
const demoClip = await neurolink.generate({
  input: {
    text: 'Hands typing on a keyboard with code appearing on screen, professional office environment',
    images: [officeReferenceImage],
  },
  provider: 'vertex',
  model: 'veo-3.1-generate-001',
  output: {
    mode: 'video',
    video: {
      aspectRatio: '16:9',
      length: 8,
    },
  },
});
```

### Platform-Specific Aspect Ratios

Choose the right aspect ratio for your target platform:

| Aspect Ratio | Use Case | Platform |
|-------------|----------|----------|
| `16:9` | Landscape | YouTube, websites, presentations |
| `9:16` | Portrait | TikTok, Instagram Reels, YouTube Shorts |
| `1:1` | Square | Available in the public option type, but not accepted by the current Vertex Veo validator |

For the Vertex Veo path used in this guide, choose `16:9` or `9:16`.

## Prompt Engineering for Video

Video prompts differ from image prompts in one critical way: they need to describe **motion**. A static scene description produces a video that looks like a slowly shifting photograph. Effective video prompts include camera movements, subject motion, and temporal progression.

### Motion Descriptors

- **Camera movements**: "slow pan left," "zoom in," "tracking shot," "dolly forward," "aerial descent"
- **Subject motion**: "walking toward camera," "rotating slowly," "flowing liquid," "particles dispersing"
- **Temporal progression**: "starts with X, transitions to Y," "gradually shifts from morning to evening"

### Style and Quality Modifiers

- **Cinematic quality**: "cinematic, film grain, shallow depth of field"
- **Animated**: "3D animated, Pixar style, smooth motion"
- **Documentary**: "documentary style, handheld camera, natural lighting"
- **Abstract**: "abstract motion graphics, geometric shapes, smooth transitions"

### Example: A Well-Structured Video Prompt

```typescript
// Good prompt with motion, style, and camera direction
const fs = await import('fs/promises');
const cityReferenceImage = await fs.readFile('city-skyline.png');

const result = await neurolink.generate({
  input: {
    text: `Cinematic aerial drone shot slowly descending over a futuristic city at sunset,
    neon lights beginning to glow on skyscrapers, flying cars in the distance,
    warm golden hour lighting transitioning to cool blue twilight, 4K quality`,
    images: [cityReferenceImage],
  },
  provider: 'vertex',
  model: 'veo-3.1-generate-001',
  output: {
    mode: 'video',
    video: {
      aspectRatio: '16:9',
      length: 6,
    },
  },
});
```

This prompt works well because it specifies: the camera movement (aerial descent), the subject (futuristic city), the timing (sunset transitioning to twilight), the lighting (golden hour to blue), and a quality modifier (4K). Each element gives Veo 3.1 clear guidance on what to generate.

> **Note:** The Vertex Veo handler accepts durations of 4, 6, or 8 seconds. Longer supported clips take more time to generate and can make complex motion harder to keep coherent.
{: .prompt-info }

## Handling Async Generation

Video generation is long-running, but NeuroLink handles the provider's polling internally and resolves once the finished video is available:

```typescript
async function generateVideo(
  prompt: string,
  referenceImage: Buffer
): Promise<Buffer> {
  const result = await neurolink.generate({
    input: { text: prompt, images: [referenceImage] },
    provider: 'vertex',
    model: 'veo-3.1-generate-001',
    output: {
      mode: 'video',
      video: { length: 6 },
    },
    timeout: 300000,
  });

  if (!result.video) {
    throw new Error('No video generated');
  }
  return result.video.data;
}
```

For production web applications, the best pattern is to queue video generation as a background job:

1. Accept the generation request from the user and return immediately with a job ID.
2. Process the generation in a background worker (using Bull, BullMQ, or similar).
3. Store the completed video in object storage (S3, GCS).
4. Notify the user via WebSocket, Server-Sent Events, or email when the video is ready.

## Building a Video Content Pipeline

Here is a complete example that combines LLM-powered prompt optimization with platform-specific video generation:

```typescript
import { NeuroLink } from '@juspay/neurolink';
import { readFile } from 'fs/promises';

const neurolink = new NeuroLink();

interface VideoRequest {
  topic: string;
  referenceImage: Buffer;
  platform: 'youtube' | 'tiktok' | 'instagram';
  style: 'cinematic' | 'animated' | 'minimalist';
}

const platformConfig = {
  youtube: { aspectRatio: '16:9' as const, duration: 6 as const },
  tiktok: { aspectRatio: '9:16' as const, duration: 4 as const },
  instagram: { aspectRatio: '9:16' as const, duration: 6 as const },
};

async function generateSocialVideo(request: VideoRequest): Promise<Buffer> {
  const config = platformConfig[request.platform];

  // Step 1: Generate optimized video prompt using LLM
  const promptResult = await neurolink.generate({
    input: { text: `Create a detailed video generation prompt for social media content.
Topic: ${request.topic}
Platform: ${request.platform}
Style: ${request.style}
Duration: ${config.duration} seconds
Include camera movements, lighting, and pacing appropriate for the platform.
Return ONLY the video prompt.` },
    provider: 'openai',
    model: 'gpt-5.4',
    temperature: 0.7,
  });

  // Step 2: Generate the video from the supplied reference image
  const videoResult = await neurolink.generate({
    input: { text: promptResult.content, images: [request.referenceImage] },
    provider: 'vertex',
    model: 'veo-3.1-generate-001',
    output: {
      mode: 'video',
      video: {
        aspectRatio: config.aspectRatio,
        length: config.duration,
      },
    },
  });

  if (!videoResult.video?.data) {
    throw new Error('No video generated');
  }
  return videoResult.video.data;
}

// Usage
const video = await generateSocialVideo({
  topic: 'Launch of our new AI features',
  referenceImage: await readFile('launch-keyframe.png'),
  platform: 'tiktok',
  style: 'animated',
});
```

```mermaid
flowchart LR
    REQ["Content Brief"] --> LLM["LLM<br/>Optimize Prompt"]
    LLM --> VEO["Veo 3.1<br/>Generate Video"]
    VEO --> POST["Post-Process<br/>Transcode"]
    POST --> STORE["Object Storage"]
    STORE --> CDN["CDN Delivery"]
    CDN --> PLATFORMS["YouTube / TikTok / Instagram"]

    style REQ fill:#3b82f6,stroke:#2563eb,color:#fff
    style LLM fill:#6366f1,stroke:#4f46e5,color:#fff
    style VEO fill:#f59e0b,stroke:#d97706,color:#fff
    style POST fill:#10b981,stroke:#059669,color:#fff
    style STORE fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style CDN fill:#22c55e,stroke:#16a34a,color:#fff
```

The two-stage pattern lets the LLM turn a short content brief into a detailed prompt with camera, lighting, and pacing instructions before Veo animates the reference image.

## Error Handling and Limitations

### Timeout Handling

Video generation can exceed default HTTP timeout values. Always set generous timeouts for video operations:

```typescript
// videoPrompt and referenceImage are assumed to be defined earlier in your pipeline
try {
  const result = await neurolink.generate({
    input: { text: videoPrompt, images: [referenceImage] },
    provider: 'vertex',
    model: 'veo-3.1-generate-001',
    output: {
      mode: 'video',
      video: { length: 8 },
    },
    timeout: 300000, // 5 minutes
  });
} catch (error: unknown) {
  if (error instanceof Error && error.message.includes('timeout')) {
    console.log('Video generation timed out. Try a shorter duration or simpler prompt.');
  }
}
```

### Content Safety

Video generation APIs include content safety filters similar to image generation. Prompts that violate usage policies are rejected. Handle these rejections gracefully with user-friendly messages rather than raw error dumps.

### Current Limitations

- **Duration**: The Vertex Veo handler accepts 4, 6, or 8 seconds. Other video providers have their own supported lengths.
- **Resolution**: The Vertex Veo handler accepts `720p` or `1080p`; 4K is not an available option in this API.
- **Consistency**: Complex scenes with multiple moving subjects can produce inconsistent motion. Simpler scenes with fewer moving elements produce better results.
- **Generation time**: Longer durations and higher complexity generally increase wait times.

### Cost Considerations

Video generation is typically more expensive than image generation, and provider pricing changes over time. Check current pricing for your chosen provider and use these cost management strategies:

- Generate 4-second clips for social media where brevity is expected
- Use LLM prompt optimization to reduce the number of generation attempts
- Cache generated videos aggressively -- video content is rarely personalized
- Set per-user or per-project generation limits

## Production Considerations

### Job Queuing

For production deployments, never generate videos synchronously in request handlers. Use a job queue:

```typescript
import { Queue, Worker } from 'bullmq';

const videoQueue = new Queue('video-generation');

// API endpoint: queue the job
app.post('/api/generate-video', async (req, res) => {
  const job = await videoQueue.add('generate', {
    prompt: req.body.prompt,
    platform: req.body.platform,
    userId: req.user.id,
  });
  res.json({ jobId: job.id, status: 'queued' });
});

// Worker: process jobs in background
const worker = new Worker('video-generation', async (job) => {
  const video = await generateSocialVideo(job.data);
  await uploadToStorage(video, `videos/${job.id}.mp4`);
  await notifyUser(job.data.userId, job.id);
});
```

### Storage and Delivery

Generated videos should be stored in object storage (AWS S3, Google Cloud Storage) and served through a CDN. `result.video.data` is already a raw `Buffer`, so write or upload it directly using `result.video.mediaType` as the content type.

### Progress Notifications

Keep users informed during the generation process. WebSocket connections or Server-Sent Events can push status updates: "Queued," "Generating," "Processing," "Ready."

## What's Next

You have completed all the steps in this guide. To continue building on what you have learned:

1. Review the code examples and adapt them for your specific use case
2. Start with the simplest pattern first and add complexity as your requirements grow
3. Monitor performance metrics to validate that each change improves your system
4. Consult the NeuroLink documentation for advanced configuration options

---

**Related posts:**

- [Image Generation with NeuroLink: Gemini Imagen and Beyond](/posts/image-generation-neurolink/)
- [Multimodal Document Processing with NeuroLink](/posts/multimodal-document-processing/)
- [From Raw Data to Reports: Automating Business Intelligence with AI](/posts/raw-data-to-reports-automating-bi-with-ai/)
