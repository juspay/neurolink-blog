import * as fs from "fs";
import * as path from "path";

const MANIFEST_FILE = path.resolve(__dirname, "../src/data/post-manifest.json");
const OUTPUT_FILE = path.resolve(__dirname, "../src/data/tone-assignments.json");

type ToneCategory =
  | "tutorial"
  | "deep-dive"
  | "comparison"
  | "opinion"
  | "announcement"
  | "beginner";

interface PostManifest {
  slug: string;
  title: string;
  categories: string[];
  tags: string[];
}

interface ToneAssignment {
  slug: string;
  title: string;
  tone: ToneCategory;
  reason: string;
}

function classifyTone(post: PostManifest): { tone: ToneCategory; reason: string } {
  const title = post.title.toLowerCase();
  const cats = post.categories.map((c) => c.toLowerCase());
  const tags = post.tags.map((t) => t.toLowerCase());
  const all = [title, ...cats, ...tags].join(" ");

  // Announcement
  if (
    cats.includes("announcement") ||
    cats.includes("announcements") ||
    cats.includes("release") ||
    title.includes("release") ||
    title.includes("roadmap") ||
    title.includes("year in review") ||
    title.includes("welcome to")
  ) {
    return { tone: "announcement", reason: "release/announcement content" };
  }

  // Beginner-friendly
  if (
    title.includes("what is") ||
    title.includes("getting started") ||
    title.includes("quickstart") ||
    title.includes("your first") ||
    title.includes("10 things") ||
    title.includes("explained")
  ) {
    return { tone: "beginner", reason: "introductory/getting-started content" };
  }

  // Deep-dive
  if (
    title.includes("how we built") ||
    title.includes("how we scaled") ||
    title.includes("how we document") ||
    title.includes("factory") ||
    title.includes("registry") ||
    title.includes("architecture") ||
    title.includes("deep dive") ||
    title.includes("middleware system") ||
    title.includes("event system") ||
    title.includes("workflow engine") ||
    title.includes("multi-agent") ||
    title.includes("context compaction") ||
    title.includes("advanced rag") ||
    cats.includes("deep dive")
  ) {
    return { tone: "deep-dive", reason: "architecture/internals content" };
  }

  // Opinion
  if (
    title.includes("future of") ||
    title.includes("rise of") ||
    (title.includes("why") && !title.includes("guide")) ||
    title.includes("hidden cost") ||
    title.includes("build vs buy") ||
    title.includes("lessons") ||
    (title.includes("open source") && title.includes("why")) ||
    title.includes("usb-c") ||
    title.includes("contributor to maintainer") ||
    all.includes("opinion") ||
    all.includes("thought-leadership") ||
    cats.includes("thought leadership")
  ) {
    return { tone: "opinion", reason: "opinion/thought-leadership content" };
  }

  // Comparison
  if (
    title.includes(" vs ") ||
    title.includes("comparison") ||
    title.includes("landscape") ||
    title.includes("total cost of") ||
    title.includes("sdk vs gateway") ||
    title.includes("choosing") ||
    cats.includes("comparison") ||
    cats.includes("comparisons")
  ) {
    return { tone: "comparison", reason: "comparison/evaluation content" };
  }

  // Default: Tutorial
  return { tone: "tutorial", reason: "practical guide/tutorial content" };
}

function generateToneAssignments(): void {
  const manifest: PostManifest[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));
  const assignments: ToneAssignment[] = [];

  const counts: Record<ToneCategory, number> = {
    tutorial: 0,
    "deep-dive": 0,
    comparison: 0,
    opinion: 0,
    announcement: 0,
    beginner: 0,
  };

  for (const post of manifest) {
    const { tone, reason } = classifyTone(post);
    assignments.push({ slug: post.slug, title: post.title, tone, reason });
    counts[tone]++;
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(assignments, null, 2));

  console.log("Tone distribution:");
  for (const [tone, count] of Object.entries(counts)) {
    console.log(`  ${tone}: ${count}`);
  }
  console.log(`\nSaved -> ${OUTPUT_FILE}`);
}

generateToneAssignments();
