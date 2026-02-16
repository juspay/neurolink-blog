import * as fs from "fs";
import * as path from "path";

const MANIFEST_FILE = path.resolve(__dirname, "../src/data/post-manifest.json");
const TONE_FILE = path.resolve(__dirname, "../src/data/tone-assignments.json");
const OUTPUT_FILE = path.resolve(__dirname, "../src/data/hero-prompts.json");

interface PostManifest {
  slug: string;
  title: string;
  tags: string[];
  description: string;
}

interface ToneAssignment {
  slug: string;
  tone: string;
}

interface HeroPrompt {
  slug: string;
  title: string;
  prompt: string;
  tone: string;
}

// Map common tags/topics to visual scene descriptions
const topicScenes: Record<string, string> = {
  openai: "interconnected neural network with glowing API endpoints",
  anthropic: "elegant layered architecture with flowing data streams",
  "google-ai": "geometric constellation of connected AI services",
  streaming: "flowing river of data particles transforming into text",
  rag: "documents being decomposed into luminous vector fragments flowing into a knowledge graph",
  mcp: "four different transport protocol channels merging into a unified hub",
  agents: "autonomous AI entities collaborating through glowing communication channels",
  middleware: "layered transparent filters processing a beam of light",
  testing: "quality gates with checkmarks and evaluation meters",
  deployment: "container orchestration with health monitoring dashboards",
  security: "shield with encrypted data streams and verification locks",
  monitoring: "real-time metrics dashboard with flowing telemetry data",
  providers: "multiple cloud service icons connected by glowing pathways",
  failover: "redundant network paths rerouting around a failed node",
  "cost-optimization": "balance scale weighing performance against cost tokens",
  "structured-output": "raw text transforming into organized JSON structures",
  multimodal: "images, audio, and text converging into a unified processing stream",
  embeddings: "high-dimensional vector space with clustered data points",
  chatbot: "conversational bubbles with AI brain processing in between",
  healthcare: "medical cross symbol integrated with AI processing pipeline",
  fintech: "financial data flowing through secure AI analysis pipeline",
  ecommerce: "product catalog with intelligent recommendation pathways",
};

// Adjust mood based on tone
const moodMap: Record<string, string> = {
  tutorial: "clean, organized, welcoming",
  "deep-dive": "complex, layered, technical",
  comparison: "balanced, structured, analytical",
  opinion: "bold, dynamic, forward-looking",
  announcement: "celebratory, vibrant, exciting",
  beginner: "simple, bright, inviting",
};

function buildPrompt(post: PostManifest, tone: string): string {
  // Find the most relevant scene based on tags
  let scene = "abstract technology workspace with floating code elements and neural network patterns";

  for (const tag of post.tags) {
    if (topicScenes[tag]) {
      scene = topicScenes[tag];
      break;
    }
  }

  const mood = moodMap[tone] || "modern, technical";

  return `Abstract digital illustration, ${scene}, dark background with blue (#016fb9) and orange (#ff9505) accent lighting, ${mood} aesthetic, minimal, modern, technology art style, cinematic lighting, no text, no logos, no words, no letters`;
}

function generateHeroPrompts(): void {
  const manifest: PostManifest[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));
  const toneAssignments: ToneAssignment[] = JSON.parse(fs.readFileSync(TONE_FILE, "utf-8"));
  const toneMap = new Map(toneAssignments.map((t) => [t.slug, t.tone]));

  const prompts: HeroPrompt[] = manifest.map((post) => {
    const tone = toneMap.get(post.slug) || "tutorial";
    return {
      slug: post.slug,
      title: post.title,
      prompt: buildPrompt(post, tone),
      tone,
    };
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(prompts, null, 2));
  console.log(`Generated ${prompts.length} hero prompts -> ${OUTPUT_FILE}`);
}

generateHeroPrompts();
