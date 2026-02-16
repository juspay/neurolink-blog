import * as fs from "fs";
import * as path from "path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const SPECS_FILE = path.resolve(__dirname, "../src/data/gif-specs.json");
const GIFS_DIR = path.resolve(__dirname, "../output/gifs");
const BLOG_ASSETS_DIR = path.resolve(__dirname, "../../../assets/img/posts");

interface GifSpec {
  slug: string;
  gifs: Array<{
    type: "architecture" | "code" | "concept";
    name: string;
    title?: string;
    nodes?: any[];
    connections?: any[];
    lines?: any[];
    filename?: string;
    concept?: string;
    steps?: any[];
  }>;
}

const compositionMap = {
  architecture: "ArchitectureFlow",
  code: "CodeWalkthrough",
  concept: "ConceptExplainer",
};

async function renderAllGifs(): Promise<void> {
  const specs: GifSpec[] = JSON.parse(fs.readFileSync(SPECS_FILE, "utf-8"));

  fs.mkdirSync(GIFS_DIR, { recursive: true });

  console.log("Bundling Remotion project...");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, "../src/index.ts"),
    webpackOverride: (config) => config,
  });

  let totalGifs = 0;
  for (const spec of specs) {
    totalGifs += spec.gifs.length;
  }

  console.log(`Rendering ${totalGifs} GIFs across ${specs.length} posts...`);

  let rendered = 0;
  for (const spec of specs) {
    const outputDir = path.join(GIFS_DIR, spec.slug);
    fs.mkdirSync(outputDir, { recursive: true });

    for (const gif of spec.gifs) {
      rendered++;
      const compositionId = compositionMap[gif.type];
      const outputPath = path.join(outputDir, `${gif.name}.gif`);

      console.log(`  [${rendered}/${totalGifs}] ${spec.slug}/${gif.name} (${gif.type})`);

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: compositionId,
      });

      // Build input props based on type
      let inputProps: Record<string, any> = {};
      if (gif.type === "architecture") {
        inputProps = {
          nodes: gif.nodes || [],
          connections: gif.connections || [],
          title: gif.title,
        };
      } else if (gif.type === "code") {
        inputProps = {
          code: "",
          language: "typescript",
          filename: gif.filename || "example.ts",
          lines: gif.lines || [],
        };
      } else if (gif.type === "concept") {
        inputProps = {
          concept: gif.concept || "",
          steps: gif.steps || [],
        };
      }

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "gif",
        outputLocation: outputPath,
        inputProps,
        everyNthFrame: 2,
        numberOfGifLoops: 0, // infinite loop
      });

      // Copy to blog assets
      const postAssetsDir = path.join(BLOG_ASSETS_DIR, spec.slug);
      fs.mkdirSync(postAssetsDir, { recursive: true });
      fs.copyFileSync(outputPath, path.join(postAssetsDir, `${gif.name}.gif`));
    }
  }

  console.log(`Done! ${rendered} GIFs rendered.`);
}

renderAllGifs().catch(console.error);
