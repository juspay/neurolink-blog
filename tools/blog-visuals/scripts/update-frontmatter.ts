import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.resolve(__dirname, "../../../_posts");
const MANIFEST_FILE = path.resolve(__dirname, "../src/data/post-manifest.json");
const BLOG_ASSETS_DIR = path.resolve(__dirname, "../../../assets/img/posts");

interface PostManifest {
  slug: string;
  filename: string;
  title: string;
  hasImage: boolean;
}

function updateFrontmatter(): void {
  const manifest: PostManifest[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));

  let updated = 0;
  let skipped = 0;

  for (const post of manifest) {
    const heroPath = path.join(BLOG_ASSETS_DIR, post.slug, "hero.png");

    // Skip if hero image doesn't exist
    if (!fs.existsSync(heroPath)) {
      skipped++;
      continue;
    }

    const filePath = path.join(POSTS_DIR, post.filename);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = matter(content);

    // Skip if image already set
    if (parsed.data.image?.path) {
      skipped++;
      continue;
    }

    // Add image field
    parsed.data.image = {
      path: `/assets/img/posts/${post.slug}/hero.png`,
      alt: parsed.data.title || post.title,
    };

    // Write back
    const output = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, output);
    updated++;
  }

  console.log(`Updated: ${updated}, Skipped: ${skipped}, Total: ${manifest.length}`);
}

updateFrontmatter();
