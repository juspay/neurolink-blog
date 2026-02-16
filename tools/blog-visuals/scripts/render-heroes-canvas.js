#!/usr/bin/env node
/**
 * Standalone hero image renderer using node-canvas.
 * Replicates the HeroBanner Remotion component output with dynamic
 * geometric background patterns per tone category, seeded by post slug.
 */

const fs = require("fs");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");

// ---------- paths ----------
const PROMPTS_FILE = path.resolve(__dirname, "../src/data/hero-prompts.json");
const HEROES_DIR = path.resolve(__dirname, "../output/heroes");
const BLOG_ASSETS_DIR = path.resolve(__dirname, "../../../assets/img/posts");

// ---------- brand constants ----------
const W = 1200;
const H = 630;
const PADDING_H = 60;
const PADDING_V = 40;

const colors = {
  marine: "#016fb9",
  marinLight: "#0190e0",
  marineDark: "#014a7a",
  saffron: "#ff9505",
  paprika: "#ec4e20",
  charcoal: "#353531",
  charcoalLight: "#3d3d38",
  charcoalDark: "#2a2a27",
  white: "#ffffff",
  gray400: "#94A3B8",
  green: "#22c55e",
};

const categoryColors = {
  tutorial:     { badge: colors.marine,   accent: colors.marinLight },
  "deep-dive":  { badge: colors.charcoal, accent: colors.marine },
  comparison:   { badge: colors.saffron,  accent: colors.saffron },
  opinion:      { badge: colors.paprika,  accent: colors.paprika },
  announcement: { badge: colors.marine,   accent: colors.saffron },
  beginner:     { badge: colors.green,    accent: colors.green },
};

const categoryLabels = {
  tutorial: "TUTORIAL",
  "deep-dive": "DEEP DIVE",
  comparison: "COMPARISON",
  opinion: "OPINION",
  announcement: "ANNOUNCEMENT",
  beginner: "GETTING STARTED",
};

// ---------- seeded PRNG (mulberry32) ----------
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugToSeed(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = Math.imul(31, h) + slug.charCodeAt(i);
  }
  return h >>> 0;
}

// ---------- helpers ----------
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------- background fill ----------
function drawDarkGradient(ctx) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, colors.charcoalDark);
  grad.addColorStop(0.5, colors.charcoalLight);
  grad.addColorStop(1, colors.charcoalDark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ---------- pattern drawers ----------

function drawCircuitGrid(ctx, rand, accent) {
  const cols = 12, rows = 7;
  const cellW = W / cols, cellH = H / rows;

  ctx.lineWidth = 1;
  // horizontal traces
  for (let r = 0; r < rows; r++) {
    const y = cellH * r + cellH / 2;
    const startCol = Math.floor(rand() * 3);
    const endCol = cols - Math.floor(rand() * 3);
    ctx.strokeStyle = hexToRgba(accent, 0.12 + rand() * 0.08);
    ctx.beginPath();
    ctx.moveTo(startCol * cellW, y);
    ctx.lineTo(endCol * cellW, y);
    ctx.stroke();
  }
  // vertical traces
  for (let c = 0; c < cols; c++) {
    const x = cellW * c + cellW / 2;
    const startRow = Math.floor(rand() * 2);
    const endRow = rows - Math.floor(rand() * 2);
    ctx.strokeStyle = hexToRgba(accent, 0.08 + rand() * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, startRow * cellH);
    ctx.lineTo(x, endRow * cellH);
    ctx.stroke();
  }
  // junction nodes
  for (let i = 0; i < 28; i++) {
    const col = Math.floor(rand() * cols);
    const row = Math.floor(rand() * rows);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2;
    const size = 2 + rand() * 3;
    const bright = rand() > 0.6;
    if (bright) {
      ctx.fillStyle = hexToRgba(accent, 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = bright ? accent : hexToRgba(accent, 0.4);
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLayeredWaves(ctx, rand, accent) {
  for (let l = 0; l < 5; l++) {
    const amp = 30 + rand() * 50;
    const freq = 0.003 + rand() * 0.004;
    const phase = rand() * Math.PI * 2;
    const baseY = 120 + l * 100 + (rand() - 0.5) * 40;
    const opacity = 0.06 + (4 - l) * 0.03;
    const color = l % 2 === 0 ? accent : colors.marine;

    ctx.fillStyle = hexToRgba(color, opacity);
    ctx.beginPath();
    ctx.moveTo(0, baseY + amp * Math.sin(phase));
    for (let x = 10; x <= W; x += 10) {
      ctx.lineTo(x, baseY + amp * Math.sin(freq * x + phase));
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDiagonalSplit(ctx, rand, accent) {
  const splitOffset = 80 + rand() * 120;

  // left panel
  ctx.fillStyle = hexToRgba(accent, 0.08);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W / 2 + splitOffset, 0);
  ctx.lineTo(W / 2 - splitOffset, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // right panel
  ctx.fillStyle = hexToRgba(colors.marine, 0.08);
  ctx.beginPath();
  ctx.moveTo(W / 2 + splitOffset, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H);
  ctx.lineTo(W / 2 - splitOffset, H);
  ctx.closePath();
  ctx.fill();

  // separator lines
  for (let i = -2; i <= 2; i++) {
    const offset = i * 12;
    ctx.strokeStyle = hexToRgba(accent, 0.15 + Math.abs(i) * 0.05);
    ctx.lineWidth = i === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 + splitOffset + offset, 0);
    ctx.lineTo(W / 2 - splitOffset + offset, H);
    ctx.stroke();
  }

  // dots
  for (let i = 0; i < 20; i++) {
    const side = i < 10 ? "left" : "right";
    const cx = side === "left" ? rand() * (W / 2 - 60) + 30 : W / 2 + 60 + rand() * (W / 2 - 90);
    const cy = rand() * H;
    const r = 2 + rand() * 4;
    const dotColor = side === "left" ? accent : colors.marine;
    ctx.fillStyle = hexToRgba(dotColor, 0.2 + rand() * 0.15);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGeometricShapes(ctx, rand, accent) {
  const shapeColors = [accent, colors.saffron, colors.paprika, colors.marine];

  for (let i = 0; i < 18; i++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const size = 30 + rand() * 80;
    const rotation = (rand() * 360 * Math.PI) / 180;
    const color = shapeColors[Math.floor(rand() * shapeColors.length)];
    const opacity = 0.04 + rand() * 0.08;
    const type = Math.floor(rand() * 3);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    if (type === 0) {
      // triangle
      const h = size * 0.866;
      ctx.strokeStyle = hexToRgba(color, opacity * 3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(-size / 2, h / 2);
      ctx.lineTo(size / 2, h / 2);
      ctx.closePath();
      ctx.stroke();
    } else if (type === 1) {
      // diamond
      ctx.fillStyle = hexToRgba(color, opacity);
      ctx.strokeStyle = hexToRgba(color, opacity * 2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 3, 0);
      ctx.lineTo(0, size / 2);
      ctx.lineTo(-size / 3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // hexagon
      ctx.fillStyle = hexToRgba(color, opacity);
      ctx.strokeStyle = hexToRgba(color, opacity * 2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const angle = (Math.PI / 3) * j - Math.PI / 6;
        const px = (size / 2) * Math.cos(angle);
        const py = (size / 2) * Math.sin(angle);
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawRadialBurst(ctx, rand, accent) {
  const cx = W / 2 + (rand() - 0.5) * 200;
  const cy = H / 2 + (rand() - 0.5) * 100;

  // rays
  const rayCount = 24 + Math.floor(rand() * 12);
  for (let i = 0; i < rayCount; i++) {
    const angle = (Math.PI * 2 * i) / rayCount + rand() * 0.1;
    const length = 200 + rand() * 400;
    const x2 = cx + Math.cos(angle) * length;
    const y2 = cy + Math.sin(angle) * length;
    ctx.strokeStyle = hexToRgba(i % 2 === 0 ? accent : colors.saffron, 0.06 + rand() * 0.06);
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // rings
  for (let r = 1; r <= 4; r++) {
    const radius = r * 80 + rand() * 30;
    ctx.strokeStyle = hexToRgba(accent, 0.06 + (4 - r) * 0.02);
    ctx.lineWidth = 1;
    if (r % 2 === 0) ctx.setLineDash([8, 6]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // center glow
  ctx.fillStyle = hexToRgba(accent, 0.12);
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.fill();
}

function drawDotsBubbles(ctx, rand, accent) {
  // dot grid
  const spacing = 40;
  for (let x = spacing; x < W; x += spacing) {
    for (let y = spacing; y < H; y += spacing) {
      if (rand() > 0.6) {
        ctx.fillStyle = hexToRgba(accent, 0.12 + rand() * 0.08);
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * 8, y + (rand() - 0.5) * 8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // bubbles
  for (let i = 0; i < 16; i++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const r = 15 + rand() * 50;
    const bubbleColor = i % 3 === 0 ? colors.marine : accent;
    ctx.strokeStyle = hexToRgba(bubbleColor, 0.08 + rand() * 0.06);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (rand() > 0.5) {
      ctx.fillStyle = hexToRgba(bubbleColor, 0.03);
      ctx.beginPath();
      ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const patternDrawers = {
  tutorial: drawCircuitGrid,
  "deep-dive": drawLayeredWaves,
  comparison: drawDiagonalSplit,
  opinion: drawGeometricShapes,
  announcement: drawRadialBurst,
  beginner: drawDotsBubbles,
};

// ---------- glow effect ----------
function drawGlow(ctx, x, y, size, color, opacity) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
  grad.addColorStop(0, hexToRgba(color, opacity));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
}

// ---------- overlay gradient ----------
function drawOverlay(ctx) {
  const grad = ctx.createLinearGradient(0, H, 0, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.85)");
  grad.addColorStop(0.4, "rgba(0,0,0,0.4)");
  grad.addColorStop(1, "rgba(0,0,0,0.1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ---------- text helpers ----------
function wrapText(ctx, text, maxWidth, fontSize) {
  ctx.font = `700 ${fontSize}px "IBM Plex Sans", sans-serif`;
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + " " + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines.slice(0, 3); // max 3 lines
}

/**
 * Draw all content elements using bottom-up stacking from the bottom of the canvas.
 * Order (bottom to top): footer -> separator -> title -> badge
 * Each element returns the Y coordinate of its top edge so the next element above
 * knows where to position itself.
 */
function drawContent(ctx, title, category, accent) {
  const { badge: badgeColor } = categoryColors[category];
  const label = categoryLabels[category];
  const GAP = 16;

  // --- Footer (bottommost) ---
  const footerY = H - PADDING_V - 7; // vertical center of footer text
  ctx.font = `500 14px "IBM Plex Sans", sans-serif`;
  ctx.fillStyle = colors.gray400;
  ctx.textBaseline = "middle";
  ctx.fillText("neurolink.ink/blog", PADDING_H, footerY);

  const rightX = W - PADDING_H;
  ctx.font = `700 18px "IBM Plex Sans", sans-serif`;
  ctx.fillStyle = colors.saffron;
  const linkW = ctx.measureText("Link").width;
  ctx.fillText("Link", rightX - linkW, footerY);
  ctx.fillStyle = colors.white;
  const neuroW = ctx.measureText("Neuro").width;
  ctx.fillText("Neuro", rightX - linkW - 8 - neuroW, footerY);

  let cursor = footerY - 14; // top of footer region

  // --- Separator line ---
  cursor -= 8; // margin below separator
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(PADDING_H, cursor - 3, 80, 3, 2);
  ctx.fill();
  cursor -= 3; // separator height
  cursor -= 8; // margin above separator

  // --- Title ---
  const titleFontSize = 42;
  const titleLineHeight = 1.2;
  const maxWidth = W - PADDING_H * 2;
  const lines = wrapText(ctx, title, maxWidth, titleFontSize);
  const titleBlockH = lines.length * titleFontSize * titleLineHeight;

  cursor -= GAP;
  const titleTop = cursor - titleBlockH;

  ctx.font = `700 ${titleFontSize}px "IBM Plex Sans", sans-serif`;
  ctx.fillStyle = colors.white;
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], PADDING_H, titleTop + i * titleFontSize * titleLineHeight);
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  cursor = titleTop;

  // --- Category badge ---
  const badgeFontSize = 12;
  const badgePaddingH = 16;
  const badgePaddingV = 6;
  const badgeBorderRadius = 4;

  ctx.font = `600 ${badgeFontSize}px "IBM Plex Sans", sans-serif`;
  const badgeTextW = ctx.measureText(label).width * 1.1;
  const badgeW = badgeTextW + badgePaddingH * 2;
  const badgeH = badgeFontSize + badgePaddingV * 2;

  cursor -= GAP;
  const badgeTop = cursor - badgeH;

  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.roundRect(PADDING_H, badgeTop, badgeW, badgeH, badgeBorderRadius);
  ctx.fill();

  ctx.fillStyle = colors.white;
  ctx.textBaseline = "middle";
  ctx.fillText(label, PADDING_H + badgePaddingH, badgeTop + badgeH / 2);
}

// ---------- main render function ----------
function renderHero(slug, title, tone) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const { accent } = categoryColors[tone] || categoryColors.tutorial;
  const rand = mulberry32(slugToSeed(slug));

  // 1. Dark gradient base
  drawDarkGradient(ctx);

  // 2. Dynamic pattern
  const drawPattern = patternDrawers[tone] || patternDrawers.tutorial;
  drawPattern(ctx, rand, accent);

  // 3. Glow effects (randomized positions)
  const glowSize1 = 200 + Math.floor(rand() * 100);
  const glowX1 = 80 + Math.floor(rand() * 200);
  const glowY1 = 400 + Math.floor(rand() * 150);
  drawGlow(ctx, glowX1, glowY1, glowSize1, accent, 0.15);

  const glowSize2 = 250 + Math.floor(rand() * 150);
  const glowX2 = 900 + Math.floor(rand() * 200);
  const glowY2 = 60 + Math.floor(rand() * 120);
  drawGlow(ctx, glowX2, glowY2, glowSize2, colors.marine, 0.1);

  // 4. Dark overlay for text readability
  drawOverlay(ctx);

  // 5. All content elements (badge, title, separator, footer)
  drawContent(ctx, title, tone, accent);

  return canvas.toBuffer("image/png");
}

// ---------- main ----------
async function main() {
  const prompts = JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf-8"));

  fs.mkdirSync(HEROES_DIR, { recursive: true });
  fs.mkdirSync(BLOG_ASSETS_DIR, { recursive: true });

  console.log(`Rendering ${prompts.length} hero images with canvas...`);

  let errors = 0;
  for (let i = 0; i < prompts.length; i++) {
    const { slug, title, tone } = prompts[i];
    try {
      const buf = renderHero(slug, title, tone);

      // Write to output/heroes/
      const heroPath = path.join(HEROES_DIR, `${slug}.png`);
      fs.writeFileSync(heroPath, buf);

      // Copy to blog assets
      const postDir = path.join(BLOG_ASSETS_DIR, slug);
      fs.mkdirSync(postDir, { recursive: true });
      fs.writeFileSync(path.join(postDir, "hero.png"), buf);

      if ((i + 1) % 10 === 0 || i === 0 || i === prompts.length - 1) {
        console.log(`  [${i + 1}/${prompts.length}] ${slug} (${(buf.length / 1024).toFixed(0)} KB)`);
      }
    } catch (err) {
      console.error(`  [${i + 1}/${prompts.length}] ERROR ${slug}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone! ${prompts.length - errors}/${prompts.length} hero images rendered.`);
  if (errors > 0) console.log(`${errors} errors encountered.`);

  // Verify
  const heroFiles = fs.readdirSync(HEROES_DIR).filter((f) => f.endsWith(".png"));
  const assetDirs = fs.readdirSync(BLOG_ASSETS_DIR).filter((d) => {
    const p = path.join(BLOG_ASSETS_DIR, d, "hero.png");
    return fs.existsSync(p);
  });
  console.log(`\nVerification:`);
  console.log(`  output/heroes/ : ${heroFiles.length} PNG files`);
  console.log(`  assets/img/posts/*/hero.png : ${assetDirs.length} hero images`);
}

main().catch(console.error);
