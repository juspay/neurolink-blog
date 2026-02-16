import { Composition, Still } from "remotion";
import { z } from "zod";
import { HeroBanner } from "./compositions/HeroBanner";
import { ArchitectureFlow } from "./compositions/ArchitectureFlow";
import { CodeWalkthrough } from "./compositions/CodeWalkthrough";
import { ConceptExplainer } from "./compositions/ConceptExplainer";

const heroBannerSchema = z.object({
  slug: z.string().optional(),
  backgroundImage: z.string(),
  title: z.string(),
  category: z.enum(["tutorial", "deep-dive", "comparison", "opinion", "announcement", "beginner"]),
  date: z.string(),
});

const flowNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string().optional(),
  appearFrame: z.number(),
});

const flowArrowSchema = z.object({
  fromX: z.number(),
  fromY: z.number(),
  toX: z.number(),
  toY: z.number(),
  color: z.string().optional(),
  appearFrame: z.number(),
  particleFrame: z.number(),
});

const architectureFlowSchema = z.object({
  nodes: z.array(flowNodeSchema),
  connections: z.array(flowArrowSchema),
  title: z.string().optional(),
});

const tokenSchema = z.object({
  text: z.string(),
  type: z.string(),
});

const codeLineSchema = z.object({
  tokens: z.array(tokenSchema),
  indent: z.number(),
});

const codeWalkthroughSchema = z.object({
  code: z.string(),
  language: z.string(),
  filename: z.string(),
  lines: z.array(codeLineSchema).optional(),
});

const conceptStepSchema = z.object({
  label: z.string(),
  icon: z.string(),
  description: z.string().optional(),
  x: z.number(),
  y: z.number(),
});

const conceptExplainerSchema = z.object({
  concept: z.string(),
  steps: z.array(conceptStepSchema),
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Still
        id="HeroBanner"
        component={HeroBanner}
        schema={heroBannerSchema}
        width={1200}
        height={630}
        defaultProps={{
          backgroundImage: "",
          title: "Sample Post Title",
          category: "tutorial" as const,
          date: "2025-06-04",
        }}
      />
      <Composition
        id="ArchitectureFlow"
        component={ArchitectureFlow}
        schema={architectureFlowSchema}
        width={800}
        height={450}
        fps={15}
        durationInFrames={75}
        defaultProps={{
          nodes: [],
          connections: [],
        }}
      />
      <Composition
        id="CodeWalkthrough"
        component={CodeWalkthrough}
        schema={codeWalkthroughSchema}
        width={800}
        height={450}
        fps={15}
        durationInFrames={120}
        defaultProps={{
          code: "",
          language: "typescript",
          filename: "example.ts",
        }}
      />
      <Composition
        id="ConceptExplainer"
        component={ConceptExplainer}
        schema={conceptExplainerSchema}
        width={800}
        height={450}
        fps={15}
        durationInFrames={90}
        defaultProps={{
          concept: "rag",
          steps: [],
        }}
      />
    </>
  );
};
