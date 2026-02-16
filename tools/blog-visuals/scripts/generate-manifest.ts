import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.resolve(__dirname, "../../../_posts");
const OUTPUT_FILE = path.resolve(__dirname, "../src/data/post-manifest.json");

interface PostManifest {
  slug: string;
  filename: string;
  title: string;
  date: string;
  categories: string[];
  tags: string[];
  description: string;
  hasMermaid: boolean;
  hasImage: boolean;
  existingImagePath?: string;
}

function generateManifest(): PostManifest[] {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md")).sort();
  const manifest: PostManifest[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
    const { data } = matter(content);

    // Extract slug from filename: 2025-06-04-welcome-to-neurolink-blog.md -> welcome-to-neurolink-blog
    const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");

    manifest.push({
      slug,
      filename: file,
      title: data.title || "",
      date: data.date?.toString() || "",
      categories: data.categories || [],
      tags: data.tags || [],
      description: data.description || "",
      hasMermaid: data.mermaid === true,
      hasImage: !!data.image,
      existingImagePath: data.image?.path,
    });
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));

  console.log(`Generated manifest for ${manifest.length} posts -> ${OUTPUT_FILE}`);
  return manifest;
}

generateManifest();
