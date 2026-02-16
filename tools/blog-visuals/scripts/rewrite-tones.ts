import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.resolve(__dirname, "../../../_posts");
const TONE_FILE = path.resolve(__dirname, "../src/data/tone-assignments.json");
const MANIFEST_FILE = path.resolve(__dirname, "../src/data/post-manifest.json");

interface ToneAssignment {
  slug: string;
  title: string;
  tone: string;
}

interface PostManifestEntry {
  slug: string;
  filename: string;
}

const voiceInstructions: Record<string, string> = {
  beginner: `Voice: The Friendly Mentor. Use analogies, say "imagine you...", avoid jargon, explain acronyms on first use, be encouraging. Example opening: "You've heard about AI SDKs but aren't sure where to start. Let's fix that."`,

  tutorial: `Voice: The Practical Guide. Be direct, use second-person ("you will build..."), state clear outcomes upfront. Example opening: "By the end of this guide, you'll have OpenAI integrated with fallback to Anthropic."`,

  "deep-dive": `Voice: The Systems Engineer. Be dense, use first-person plural ("we designed..."), discuss trade-offs, reference internals, assume expertise. Example opening: "The monolithic BaseProvider was a liability. We decomposed it."`,

  opinion: `Voice: The Industry Voice. Be opinionated, use data/trends, take clear positions, open provocatively. Example opening: "No single AI provider will win. Anyone betting their architecture on one model is building on sand."`,

  comparison: `Voice: The Honest Evaluator. Be balanced, evidence-based, acknowledge competitor strengths, use tables/data. Example opening: "LangChain and NeuroLink solve different problems. Here's an honest look."`,

  announcement: `Voice: The Excited Builder. Be concise, feature-focused, celebrate milestones, link to deeper content. Example opening: "v9.0 is here. Modular core, RAG pipelines, 4 MCP transports."`,
};

async function rewritePost(
  filePath: string,
  tone: string
): Promise<{ original: string; rewritten: string } | null> {
  const content = fs.readFileSync(filePath, "utf-8");
  const { data, content: markdown } = matter(content);

  const voice = voiceInstructions[tone];
  if (!voice) return null;

  // TODO: Call AI model via NeuroLink SDK to rewrite
  // For now, this is a placeholder that logs what would be rewritten
  //
  // The actual implementation will:
  // 1. Extract the intro (first 1-3 paragraphs before first ## heading)
  // 2. Extract callout boxes ({: .prompt-info}, {: .prompt-tip}, etc.)
  // 3. Extract the "What's Next" / conclusion section
  // 4. Send these sections + voice instructions to the AI model
  // 5. Replace the sections in the original markdown
  // 6. Preserve all code blocks, Mermaid diagrams, tables unchanged

  console.log(`  Would rewrite with "${tone}" voice: ${path.basename(filePath)}`);
  return null;
}

async function rewriteAll(): Promise<void> {
  const assignments: ToneAssignment[] = JSON.parse(fs.readFileSync(TONE_FILE, "utf-8"));
  const manifest: PostManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));
  const filenameMap = new Map(manifest.map((p) => [p.slug, p.filename]));

  console.log(`Processing ${assignments.length} posts for tone rewriting...`);

  for (const assignment of assignments) {
    const filename = filenameMap.get(assignment.slug);
    if (!filename) continue;

    const filePath = path.join(POSTS_DIR, filename);
    await rewritePost(filePath, assignment.tone);
  }

  console.log("Done!");
}

rewriteAll().catch(console.error);
