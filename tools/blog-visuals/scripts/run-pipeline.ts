import { execSync } from "child_process";
import * as path from "path";

const scriptsDir = __dirname;

const steps = [
  { name: "Generate manifest", script: "generate-manifest.ts" },
  { name: "Generate tone assignments", script: "generate-tone-assignments.ts" },
  { name: "Generate hero prompts", script: "generate-hero-prompts.ts" },
  { name: "Render hero images", script: "render-heroes.ts" },
  { name: "Render GIFs", script: "render-gifs.ts" },
  { name: "Update front matter", script: "update-frontmatter.ts" },
  // { name: "Rewrite tones", script: "rewrite-tones.ts" }, // Enable when AI integration is ready
];

async function runPipeline(): Promise<void> {
  console.log("=== Blog Visual Content Pipeline ===\n");

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n[${i + 1}/${steps.length}] ${step.name}`);
    console.log("-".repeat(40));

    try {
      execSync(`npx ts-node ${path.join(scriptsDir, step.script)}`, {
        stdio: "inherit",
        cwd: path.resolve(scriptsDir, ".."),
      });
      console.log(`[OK] ${step.name} complete`);
    } catch (error) {
      console.error(`[FAIL] ${step.name} failed`);
      process.exit(1);
    }
  }

  console.log("\n=== Pipeline complete ===");
}

runPipeline();
