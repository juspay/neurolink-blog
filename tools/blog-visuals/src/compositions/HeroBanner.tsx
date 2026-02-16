import React from "react";
import { AbsoluteFill } from "remotion";
import { CategoryBadge } from "../components/CategoryBadge";
import { Title } from "../components/Title";
import { BrandFooter } from "../components/BrandFooter";
import { FontLoader } from "../components/FontLoader";
import { GlowEffect } from "../components/GlowEffect";
import { colors, gradients, categoryColors, heroLayout, type ToneCategory } from "../theme";

// ---------- seeded PRNG (mulberry32) ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugToSeed(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = Math.imul(31, h) + slug.charCodeAt(i);
  }
  return h >>> 0;
}

// ---------- helpers ----------
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------- pattern renderers ----------

/** Tutorial: circuit-board grid with glowing nodes */
function CircuitGrid({ rand, accent }: { rand: () => number; accent: string }) {
  const W = 1200;
  const H = 630;
  const cols = 12;
  const rows = 7;
  const cellW = W / cols;
  const cellH = H / rows;

  const lines: React.ReactNode[] = [];
  const nodes: React.ReactNode[] = [];

  // horizontal traces
  for (let r = 0; r < rows; r++) {
    const y = cellH * r + cellH / 2;
    const startCol = Math.floor(rand() * 3);
    const endCol = cols - Math.floor(rand() * 3);
    lines.push(
      <line
        key={`h-${r}`}
        x1={startCol * cellW}
        y1={y}
        x2={endCol * cellW}
        y2={y}
        stroke={hexToRgba(accent, 0.12 + rand() * 0.08)}
        strokeWidth={1}
      />,
    );
  }

  // vertical traces
  for (let c = 0; c < cols; c++) {
    const x = cellW * c + cellW / 2;
    const startRow = Math.floor(rand() * 2);
    const endRow = rows - Math.floor(rand() * 2);
    lines.push(
      <line
        key={`v-${c}`}
        x1={x}
        y1={startRow * cellH}
        x2={x}
        y2={endRow * cellH}
        stroke={hexToRgba(accent, 0.08 + rand() * 0.06)}
        strokeWidth={1}
      />,
    );
  }

  // junction nodes
  for (let i = 0; i < 28; i++) {
    const col = Math.floor(rand() * cols);
    const row = Math.floor(rand() * rows);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2;
    const size = 2 + rand() * 3;
    const bright = rand() > 0.6;
    nodes.push(
      <circle
        key={`n-${i}`}
        cx={cx}
        cy={cy}
        r={size}
        fill={bright ? accent : hexToRgba(accent, 0.4)}
      />,
    );
    if (bright) {
      nodes.push(
        <circle
          key={`ng-${i}`}
          cx={cx}
          cy={cy}
          r={size * 3}
          fill={hexToRgba(accent, 0.08)}
        />,
      );
    }
  }

  return (
    <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
      {lines}
      {nodes}
    </svg>
  );
}

/** Deep-dive: layered sine waves with depth */
function LayeredWaves({ rand, accent }: { rand: () => number; accent: string }) {
  const W = 1200;
  const H = 630;
  const layers: React.ReactNode[] = [];

  for (let l = 0; l < 5; l++) {
    const amp = 30 + rand() * 50;
    const freq = 0.003 + rand() * 0.004;
    const phase = rand() * Math.PI * 2;
    const baseY = 120 + l * 100 + (rand() - 0.5) * 40;
    const opacity = 0.06 + (4 - l) * 0.03;
    const color = l % 2 === 0 ? accent : colors.marine;

    let d = `M 0 ${baseY + amp * Math.sin(phase)}`;
    for (let x = 10; x <= W; x += 10) {
      const y = baseY + amp * Math.sin(freq * x + phase);
      d += ` L ${x} ${y}`;
    }
    d += ` L ${W} ${H} L 0 ${H} Z`;

    layers.push(
      <path
        key={`wave-${l}`}
        d={d}
        fill={hexToRgba(color, opacity)}
      />,
    );
  }

  return (
    <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
      {layers}
    </svg>
  );
}

/** Comparison: diagonal split with contrasting panels */
function DiagonalSplit({ rand, accent }: { rand: () => number; accent: string }) {
  const W = 1200;
  const H = 630;
  const splitOffset = 80 + rand() * 120;
  const elements: React.ReactNode[] = [];

  // left panel tint
  elements.push(
    <polygon
      key="left"
      points={`0,0 ${W / 2 + splitOffset},0 ${W / 2 - splitOffset},${H} 0,${H}`}
      fill={hexToRgba(accent, 0.08)}
    />,
  );

  // right panel tint
  elements.push(
    <polygon
      key="right"
      points={`${W / 2 + splitOffset},0 ${W},0 ${W},${H} ${W / 2 - splitOffset},${H}`}
      fill={hexToRgba(colors.marine, 0.08)}
    />,
  );

  // diagonal separator lines
  for (let i = -2; i <= 2; i++) {
    const offset = i * 12;
    elements.push(
      <line
        key={`sep-${i}`}
        x1={W / 2 + splitOffset + offset}
        y1={0}
        x2={W / 2 - splitOffset + offset}
        y2={H}
        stroke={hexToRgba(accent, 0.15 + Math.abs(i) * 0.05)}
        strokeWidth={i === 0 ? 2 : 1}
      />,
    );
  }

  // scattered comparison dots on each side
  for (let i = 0; i < 20; i++) {
    const side = i < 10 ? "left" : "right";
    const cx = side === "left" ? rand() * (W / 2 - 60) + 30 : W / 2 + 60 + rand() * (W / 2 - 90);
    const cy = rand() * H;
    const r = 2 + rand() * 4;
    const dotColor = side === "left" ? accent : colors.marine;
    elements.push(
      <circle key={`dot-${i}`} cx={cx} cy={cy} r={r} fill={hexToRgba(dotColor, 0.2 + rand() * 0.15)} />,
    );
  }

  return (
    <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
      {elements}
    </svg>
  );
}

/** Opinion: abstract geometric shapes (triangles, diamonds, hexagons) */
function GeometricShapes({ rand, accent }: { rand: () => number; accent: string }) {
  const W = 1200;
  const H = 630;
  const shapes: React.ReactNode[] = [];

  const shapeColors = [accent, colors.saffron, colors.paprika, colors.marine];

  for (let i = 0; i < 18; i++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const size = 30 + rand() * 80;
    const rotation = rand() * 360;
    const color = shapeColors[Math.floor(rand() * shapeColors.length)];
    const opacity = 0.04 + rand() * 0.08;
    const type = Math.floor(rand() * 3);

    if (type === 0) {
      // triangle
      const h = size * 0.866;
      shapes.push(
        <polygon
          key={`shape-${i}`}
          points={`${cx},${cy - h / 2} ${cx - size / 2},${cy + h / 2} ${cx + size / 2},${cy + h / 2}`}
          fill="none"
          stroke={hexToRgba(color, opacity * 3)}
          strokeWidth={1.5}
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />,
      );
    } else if (type === 1) {
      // diamond
      shapes.push(
        <polygon
          key={`shape-${i}`}
          points={`${cx},${cy - size / 2} ${cx + size / 3},${cy} ${cx},${cy + size / 2} ${cx - size / 3},${cy}`}
          fill={hexToRgba(color, opacity)}
          stroke={hexToRgba(color, opacity * 2)}
          strokeWidth={1}
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />,
      );
    } else {
      // hexagon
      const pts = Array.from({ length: 6 }, (_, j) => {
        const angle = (Math.PI / 3) * j - Math.PI / 6;
        return `${cx + (size / 2) * Math.cos(angle)},${cy + (size / 2) * Math.sin(angle)}`;
      }).join(" ");
      shapes.push(
        <polygon
          key={`shape-${i}`}
          points={pts}
          fill={hexToRgba(color, opacity)}
          stroke={hexToRgba(color, opacity * 2)}
          strokeWidth={1}
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />,
      );
    }
  }

  return (
    <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
      {shapes}
    </svg>
  );
}

/** Announcement: radial burst from center */
function RadialBurst({ rand, accent }: { rand: () => number; accent: string }) {
  const W = 1200;
  const H = 630;
  const cx = W / 2 + (rand() - 0.5) * 200;
  const cy = H / 2 + (rand() - 0.5) * 100;
  const elements: React.ReactNode[] = [];

  // radial rays
  const rayCount = 24 + Math.floor(rand() * 12);
  for (let i = 0; i < rayCount; i++) {
    const angle = (Math.PI * 2 * i) / rayCount + rand() * 0.1;
    const length = 200 + rand() * 400;
    const x2 = cx + Math.cos(angle) * length;
    const y2 = cy + Math.sin(angle) * length;
    const width = 1 + rand() * 2;
    elements.push(
      <line
        key={`ray-${i}`}
        x1={cx}
        y1={cy}
        x2={x2}
        y2={y2}
        stroke={hexToRgba(i % 2 === 0 ? accent : colors.saffron, 0.06 + rand() * 0.06)}
        strokeWidth={width}
      />,
    );
  }

  // concentric rings
  for (let r = 1; r <= 4; r++) {
    const radius = r * 80 + rand() * 30;
    elements.push(
      <circle
        key={`ring-${r}`}
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={hexToRgba(accent, 0.06 + (4 - r) * 0.02)}
        strokeWidth={1}
        strokeDasharray={r % 2 === 0 ? "8 6" : undefined}
      />,
    );
  }

  // center glow
  elements.push(
    <circle
      key="center"
      cx={cx}
      cy={cy}
      r={40}
      fill={hexToRgba(accent, 0.12)}
    />,
  );

  return (
    <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
      {elements}
    </svg>
  );
}

/** Beginner: friendly dots and soft bubbles */
function DotsBubbles({ rand, accent }: { rand: () => number; accent: string }) {
  const W = 1200;
  const H = 630;
  const elements: React.ReactNode[] = [];

  // regular dot grid
  const spacing = 40;
  for (let x = spacing; x < W; x += spacing) {
    for (let y = spacing; y < H; y += spacing) {
      if (rand() > 0.6) {
        elements.push(
          <circle
            key={`grid-${x}-${y}`}
            cx={x + (rand() - 0.5) * 8}
            cy={y + (rand() - 0.5) * 8}
            r={1.5}
            fill={hexToRgba(accent, 0.12 + rand() * 0.08)}
          />,
        );
      }
    }
  }

  // floating bubbles
  for (let i = 0; i < 16; i++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const r = 15 + rand() * 50;
    const bubbleColor = i % 3 === 0 ? colors.marine : accent;
    elements.push(
      <circle
        key={`bubble-${i}`}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={hexToRgba(bubbleColor, 0.08 + rand() * 0.06)}
        strokeWidth={1}
      />,
    );
    // highlight arc
    if (rand() > 0.5) {
      elements.push(
        <circle
          key={`bubble-hl-${i}`}
          cx={cx - r * 0.2}
          cy={cy - r * 0.2}
          r={r * 0.6}
          fill={hexToRgba(bubbleColor, 0.03)}
        />,
      );
    }
  }

  return (
    <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
      {elements}
    </svg>
  );
}

// ---------- pattern lookup ----------
const patternRenderers: Record<
  ToneCategory,
  React.FC<{ rand: () => number; accent: string }>
> = {
  tutorial: CircuitGrid,
  "deep-dive": LayeredWaves,
  comparison: DiagonalSplit,
  opinion: GeometricShapes,
  announcement: RadialBurst,
  beginner: DotsBubbles,
};

// ---------- main component ----------
export interface HeroBannerProps extends Record<string, unknown> {
  slug?: string;
  backgroundImage: string;
  title: string;
  category: ToneCategory;
  date: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  slug = "",
  backgroundImage,
  title,
  category,
  date,
}) => {
  const { accent } = categoryColors[category];
  const { padding } = heroLayout;
  const rand = mulberry32(slugToSeed(slug || title));
  const PatternComponent = patternRenderers[category];

  return (
    <FontLoader>
      <AbsoluteFill style={{ backgroundColor: colors.charcoalDark }}>
        {/* Base gradient background */}
        <AbsoluteFill
          style={{
            background: gradients.dark,
          }}
        />

        {/* Dynamic geometric pattern */}
        <PatternComponent rand={rand} accent={accent} />

        {/* Accent glow effects */}
        <GlowEffect
          color={accent}
          size={200 + Math.floor(rand() * 100)}
          x={80 + Math.floor(rand() * 200)}
          y={400 + Math.floor(rand() * 150)}
          opacity={0.15}
        />
        <GlowEffect
          color={colors.marine}
          size={250 + Math.floor(rand() * 150)}
          x={900 + Math.floor(rand() * 200)}
          y={60 + Math.floor(rand() * 120)}
          opacity={0.1}
        />

        {/* Dark gradient overlay for text readability */}
        <AbsoluteFill
          style={{
            background: gradients.overlay,
          }}
        />

        {/* Content */}
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: `${padding.vertical}px ${padding.horizontal}px`,
            gap: 16,
          }}
        >
          {/* Category badge */}
          <CategoryBadge category={category} />

          {/* Title */}
          <Title text={title} />

          {/* Separator line */}
          <div
            style={{
              width: 80,
              height: 3,
              backgroundColor: accent,
              borderRadius: 2,
              marginTop: 8,
              marginBottom: 8,
            }}
          />

          {/* Footer */}
          <BrandFooter />
        </AbsoluteFill>
      </AbsoluteFill>
    </FontLoader>
  );
};
