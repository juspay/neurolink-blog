import * as fs from "fs";
import * as path from "path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const PROMPTS_FILE = path.resolve(__dirname, "../src/data/hero-prompts.json");
const BACKGROUNDS_DIR = path.resolve(__dirname, "../output/backgrounds");
const HEROES_DIR = path.resolve(__dirname, "../output/heroes");
const BLOG_ASSETS_DIR = path.resolve(__dirname, "../../../assets/img/posts");

interface HeroPrompt {
  slug: string;
  title: string;
  prompt: string;
  tone: string;
}

async function generateBackground(prompt: string, outputPath: string): Promise<void> {
  // TODO: Integrate Google Imagen via NeuroLink SDK
  // For now, create a placeholder dark gradient image using sharp
  const sharp = require("sharp");
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: { r: 42, g: 42, b: 39 }, // charcoalDark
    },
  })
    .png()
    .toFile(outputPath);
}

async function renderAllHeroes(): Promise<void> {
  const prompts: HeroPrompt[] = JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf-8"));

  // Create output directories
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  fs.mkdirSync(HEROES_DIR, { recursive: true });
  fs.mkdirSync(BLOG_ASSETS_DIR, { recursive: true });

  // Bundle the Remotion project
  console.log("Bundling Remotion project...");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, "../src/index.ts"),
    webpackOverride: (config) => config,
  });

  console.log(`Rendering ${prompts.length} hero images...`);

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const bgPath = path.join(BACKGROUNDS_DIR, `${prompt.slug}.png`);
    const heroPath = path.join(HEROES_DIR, `${prompt.slug}.png`);

    // Step 1: Generate background (or use existing)
    if (!fs.existsSync(bgPath)) {
      console.log(`  [${i + 1}/${prompts.length}] Generating background: ${prompt.slug}`);
      await generateBackground(prompt.prompt, bgPath);
    }

    const inputProps = {
      slug: prompt.slug,
      backgroundImage: bgPath,
      title: prompt.title,
      category: prompt.tone,
      date: "",
    };

    // Get the HeroBanner composition with inputProps for Zod schema validation
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "HeroBanner",
      inputProps,
    });

    // Step 2: Render hero image with Remotion
    console.log(`  [${i + 1}/${prompts.length}] Rendering hero: ${prompt.slug}`);
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: heroPath,
      inputProps,
    });

    // Step 3: Copy to blog assets
    const postAssetsDir = path.join(BLOG_ASSETS_DIR, prompt.slug);
    fs.mkdirSync(postAssetsDir, { recursive: true });
    fs.copyFileSync(heroPath, path.join(postAssetsDir, "hero.png"));
  }

  console.log(`Done! ${prompts.length} hero images rendered.`);
}

renderAllHeroes().catch(console.error);
