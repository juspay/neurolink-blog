#!/usr/bin/env node
/**
 * Smart animated GIF renderer.
 *
 * Architecture: nodes appear frame-by-frame, arrows auto-connect node edges, particles flow.
 * Concept: steps auto-layout evenly, text icons (no emoji), numbered badges.
 * Code: lines type in one by one with syntax highlighting.
 *
 * The renderer computes layout from spec data -- connections are routed edge-to-edge
 * between nodes, node widths adapt to label text, and overflow is prevented automatically.
 */
const { createCanvas } = require('canvas');
const GIFEncoder = require('gif-encoder-2');
const fs = require('fs');
const path = require('path');

const SPECS_FILE = path.resolve(__dirname, '../src/data/gif-specs.json');
const BLOG_ASSETS_DIR = path.resolve(__dirname, '../../../assets/img/posts');

const WIDTH = 800;
const HEIGHT = 450;
const MARGIN = 20;
const TITLE_HEIGHT = 45;
const NODE_H = 40;
const NODE_MIN_W = 90;
const NODE_PAD = 30; // horizontal padding inside node around label

// ============================================================
// Shared drawing utilities
// ============================================================

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawBackground(ctx, accentColor) {
  // Match blog code-snippet background: #151515
  ctx.fillStyle = '#151515';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < WIDTH; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
  }

  if (accentColor) {
    const bar = ctx.createLinearGradient(0, 0, WIDTH, 0);
    bar.addColorStop(0, accentColor);
    bar.addColorStop(1, accentColor + '44');
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, WIDTH, 3);
  }
}

function drawRoundedRect(ctx, x, y, w, h, r, fillColor, strokeColor) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
  if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawArrow(ctx, fromX, fromY, toX, toY, color, progress) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const endX = fromX + dx * progress;
  const endY = fromY + dy * progress;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  if (progress > 0.8) {
    const angle = Math.atan2(dy, dx);
    const headLen = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }
}

function drawParticle(ctx, fromX, fromY, toX, toY, color, t) {
  const x = fromX + (toX - fromX) * t;
  const y = fromY + (toY - fromY) * t;

  const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 8, y - 8, 16, 16);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawWatermark(ctx) {
  ctx.globalAlpha = 0.3;
  ctx.font = '12px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#777';
  ctx.textAlign = 'right';
  ctx.fillText('neurolink.ink', WIDTH - 15, HEIGHT - 12);
  ctx.globalAlpha = 1;
}

// ============================================================
// Smart Layout Engine for Architecture GIFs
// ============================================================

/**
 * Compute dynamic node widths and adjust positions to fit within canvas.
 * Returns an array of layout objects: { x, y, w, h, cx, cy, ...originalNode }
 */
function computeNodeLayout(ctx, nodes) {
  ctx.font = 'bold 14px Arial, Helvetica, sans-serif';

  // Step 1: compute dynamic widths, handle multi-line labels
  const laid = nodes.map(n => {
    const labelLines = String(n.label).split('\n');
    const maxLineW = Math.max(...labelLines.map(l => ctx.measureText(l).width));
    const w = Math.max(NODE_MIN_W, maxLineW + NODE_PAD);
    const h = labelLines.length > 1 ? NODE_H + (labelLines.length - 1) * 16 : NODE_H;
    // Store spec-space center for connection proximity matching
    return { ...n, w, h, labelLines, origX: n.x, origY: n.y, origCx: n.x + w / 2, origCy: n.y + h / 2 };
  });

  // Step 2: find bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of laid) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }

  // Step 3: fit into usable area
  const usableLeft = MARGIN;
  const usableTop = TITLE_HEIGHT;
  const usableRight = WIDTH - MARGIN;
  const usableBottom = HEIGHT - 30; // leave room for watermark
  const usableW = usableRight - usableLeft;
  const usableH = usableBottom - usableTop;

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  // Scale if needed
  const scaleX = contentW > usableW ? usableW / contentW : 1;
  const scaleY = contentH > usableH ? usableH / contentH : 1;
  const scale = Math.min(scaleX, scaleY, 1); // never upscale

  // Center offset
  const scaledW = contentW * scale;
  const scaledH = contentH * scale;
  const offsetX = usableLeft + (usableW - scaledW) / 2 - minX * scale;
  const offsetY = usableTop + (usableH - scaledH) / 2 - minY * scale;

  for (const n of laid) {
    n.x = n.origX * scale + offsetX;
    n.y = n.origY * scale + offsetY;
    n.w = n.w * scale;
    n.h = n.h * scale;
    n.cx = n.x + n.w / 2;
    n.cy = n.y + n.h / 2;
  }

  return laid;
}

/**
 * Find the nearest node to a given (x, y) coordinate in SPEC space.
 * Uses origCx/origCy (spec-space centers) so that spec-space connection
 * coordinates match correctly against nodes before layout transformation.
 */
function findNearestNode(nodes, px, py) {
  let best = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const dx = (n.origCx != null ? n.origCx : n.cx) - px;
    const dy = (n.origCy != null ? n.origCy : n.cy) - py;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = n;
    }
  }
  return best;
}

/**
 * Compute edge-to-edge connection points between two nodes.
 * Arrow goes from the appropriate edge of `from` to the appropriate edge of `to`.
 */
function computeEdgePoints(fromNode, toNode) {
  const dx = toNode.cx - fromNode.cx;
  const dy = toNode.cy - fromNode.cy;

  let fx, fy, tx, ty;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      fx = fromNode.x + fromNode.w; // right edge
      tx = toNode.x;                // left edge
    } else {
      fx = fromNode.x;              // left edge
      tx = toNode.x + toNode.w;     // right edge
    }
    fy = fromNode.cy;
    ty = toNode.cy;
  } else {
    // Vertical connection
    if (dy > 0) {
      fy = fromNode.y + fromNode.h; // bottom edge
      ty = toNode.y;                // top edge
    } else {
      fy = fromNode.y;              // top edge
      ty = toNode.y + toNode.h;     // bottom edge
    }
    fx = fromNode.cx;
    tx = toNode.cx;
  }

  return { fromX: fx, fromY: fy, toX: tx, toY: ty };
}

/**
 * Build resolved connections: map each spec connection to edge-to-edge coordinates.
 *
 * Key fix: after finding the source node, we EXCLUDE it from the candidate set
 * when finding the target node. This prevents both endpoints from mapping to
 * the same node when spec coordinates are close together (e.g., from=150, to=190
 * where both are nearest to the source node center at 125).
 */
function resolveConnections(laidNodes, specConnections) {
  return (specConnections || []).map(conn => {
    // Find source node by proximity to spec "from" coordinates
    const srcNode = findNearestNode(laidNodes, conn.fromX, conn.fromY);
    if (!srcNode || laidNodes.length < 2) {
      return { ...conn };
    }

    // Find target node EXCLUDING the source node to prevent same-node matching
    const tgtCandidates = laidNodes.filter(n => n !== srcNode);
    const tgtNode = findNearestNode(tgtCandidates, conn.toX, conn.toY);
    if (!tgtNode) {
      return { ...conn };
    }

    const edge = computeEdgePoints(srcNode, tgtNode);
    return {
      ...conn,
      fromX: edge.fromX,
      fromY: edge.fromY,
      toX: edge.toX,
      toY: edge.toY,
    };
  });
}

// ============================================================
// Architecture GIF Renderer
// ============================================================
function renderArchitectureGif(spec) {
  const TOTAL_FRAMES = 60;
  const DELAY = 80;

  const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', false);
  encoder.setDelay(DELAY);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accentColor = spec.nodes[0]?.color || '#016fb9';

  // Pre-compute layout (once, outside frame loop)
  const laidNodes = computeNodeLayout(ctx, spec.nodes || []);
  const resolvedConns = resolveConnections(laidNodes, spec.connections);

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    drawBackground(ctx, accentColor);

    // Title
    ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(spec.title || '', MARGIN, 30);

    // Draw connections (arrows + particles)
    for (const conn of resolvedConns) {
      const appearAt = conn.appearFrame || 0;
      const particleAt = conn.particleFrame || appearAt + 4;

      if (frame >= appearAt) {
        const arrowProgress = Math.min(1, (frame - appearAt) / 8);
        drawArrow(ctx, conn.fromX, conn.fromY, conn.toX, conn.toY, conn.color || '#666', easeOutCubic(arrowProgress));
      }

      if (frame >= particleAt) {
        const t = ((frame - particleAt) % 12) / 12;
        drawParticle(ctx, conn.fromX, conn.fromY, conn.toX, conn.toY, conn.color || '#fff', t);
      }
    }

    // Draw nodes
    for (const node of laidNodes) {
      if (frame < node.appearFrame) continue;

      const entryProgress = Math.min(1, (frame - node.appearFrame) / 6);
      const ep = easeOutCubic(entryProgress);

      ctx.save();
      ctx.globalAlpha = ep;
      const scale = 0.7 + 0.3 * ep;
      ctx.translate(node.cx, node.cy);
      ctx.scale(scale, scale);
      ctx.translate(-node.cx, -node.cy);

      // Shadow
      drawRoundedRect(ctx, node.x + 2, node.y + 2, node.w, node.h, 8, 'rgba(0,0,0,0.3)', null);
      // Node box
      drawRoundedRect(ctx, node.x, node.y, node.w, node.h, 8, node.color + 'dd', node.color);
      // Label (multi-line aware)
      ctx.font = 'bold 14px Arial, Helvetica, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = node.labelLines || [node.label];
      const lineH = 16;
      const topY = node.cy - (lines.length - 1) * lineH / 2;
      for (let li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], node.cx, topY + li * lineH);
      }

      ctx.restore();
    }

    drawWatermark(ctx);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

// ============================================================
// Concept GIF Renderer (auto-layout, text icons)
// ============================================================

const ICON_ABBREVS = {
  'Providers': 'API', 'Streaming': 'STR', 'MCP Tools': 'MCP', 'RAG': 'RAG',
  'Middleware': 'MW', 'Security': 'SEC', 'Monitoring': 'MON', 'Testing': 'TST',
  'Memory': 'MEM', 'Tools': 'TLS', 'Agents': 'AGT', 'HITL': 'HITL',
  'Config': 'CFG', 'Cache': 'CCH', 'Queue': 'QUE', 'Batch': 'BCH',
  'Schema': 'SCH', 'Prompt': 'PRM', 'Model': 'MDL', 'Output': 'OUT',
  'Input': 'IN', 'Deploy': 'DEP', 'Cost': 'CST', 'Auth': 'AUT',
  'Eval': 'EVL', 'Route': 'RTE', 'Log': 'LOG', 'Embed': 'EMB',
  'Search': 'SRC', 'Store': 'STR', 'Parse': 'PRS', 'Score': 'SCR',
  'Judge': 'JDG', 'Retry': 'RTY', 'Fallback': 'FBK', 'Validate': 'VAL',
};

function getIconAbbrev(label) {
  if (ICON_ABBREVS[label]) return ICON_ABBREVS[label];
  // Generate from first 2-3 consonants/uppercase
  const upper = label.replace(/[^A-Za-z]/g, '').toUpperCase();
  return upper.substring(0, 3);
}

const STEP_COLORS = ['#016fb9', '#ff9505', '#ec4e20', '#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#22c55e'];

function renderConceptGif(spec) {
  const TOTAL_FRAMES = 50;
  const DELAY = 100;

  const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', false);
  encoder.setDelay(DELAY);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accentColor = '#016fb9';

  const steps = spec.steps || [];
  const stepCount = steps.length;
  const framesPerStep = Math.floor(TOTAL_FRAMES / (stepCount + 1));

  // Auto-layout: distribute steps evenly
  const boxW = Math.min(120, (WIDTH - MARGIN * 2) / stepCount - 15);
  const boxH = 80;
  const totalW = stepCount * boxW + (stepCount - 1) * 15;
  const startX = (WIDTH - totalW) / 2;
  const centerY = (HEIGHT - TITLE_HEIGHT) / 2 + TITLE_HEIGHT;
  const boxY = centerY - boxH / 2;

  const autoSteps = steps.map((step, i) => ({
    ...step,
    ax: startX + i * (boxW + 15),
    ay: boxY,
  }));

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    drawBackground(ctx, accentColor);

    // Title
    ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(spec.concept || spec.title || '', WIDTH / 2, 35);

    // Connecting line (dashed)
    if (autoSteps.length > 1) {
      const firstCx = autoSteps[0].ax + boxW / 2;
      const lastCx = autoSteps[autoSteps.length - 1].ax + boxW / 2;
      const lineY = boxY + boxH / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(firstCx, lineY);
      ctx.lineTo(lastCx, lineY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw steps
    for (let i = 0; i < autoSteps.length; i++) {
      const step = autoSteps[i];
      const stepAppearFrame = i * framesPerStep + 3;
      if (frame < stepAppearFrame) continue;

      const progress = Math.min(1, (frame - stepAppearFrame) / 8);
      const ep = easeOutCubic(progress);
      const offsetY = (1 - ep) * 25;

      ctx.save();
      ctx.globalAlpha = ep;

      const bx = step.ax;
      const by = step.ay + offsetY;
      const color = STEP_COLORS[i % STEP_COLORS.length];

      // Box with subtle glow
      drawRoundedRect(ctx, bx, by, boxW, boxH, 10, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)');

      // Number badge (top center)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bx + boxW / 2, by - 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), bx + boxW / 2, by - 1);

      // Icon circle (text-based, no emoji)
      const iconY = by + 28;
      ctx.fillStyle = color + '33'; // 20% opacity
      ctx.beginPath();
      ctx.arc(bx + boxW / 2, iconY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const abbrev = getIconAbbrev(step.label);
      ctx.font = 'bold 11px Arial, Helvetica, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(abbrev, bx + boxW / 2, iconY + 1);

      // Label
      ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(step.label, bx + boxW / 2, by + boxH - 12);

      ctx.restore();
    }

    // Arrow connectors between steps
    for (let i = 0; i < autoSteps.length - 1; i++) {
      const stepAppearFrame = (i + 1) * framesPerStep + 3;
      if (frame < stepAppearFrame) continue;

      const progress = Math.min(1, (frame - stepAppearFrame) / 6);
      const ep = easeOutCubic(progress);

      const fromX = autoSteps[i].ax + boxW + 2;
      const toX = autoSteps[i + 1].ax - 2;
      const lineY = boxY + boxH / 2;
      const midX = fromX + (toX - fromX) * ep;

      ctx.globalAlpha = ep * 0.6;
      ctx.strokeStyle = STEP_COLORS[i % STEP_COLORS.length];
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(fromX, lineY);
      ctx.lineTo(midX, lineY);
      ctx.stroke();

      // Small arrowhead
      if (ep > 0.9) {
        ctx.fillStyle = STEP_COLORS[(i + 1) % STEP_COLORS.length];
        ctx.beginPath();
        ctx.moveTo(midX, lineY);
        ctx.lineTo(midX - 6, lineY - 4);
        ctx.lineTo(midX - 6, lineY + 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawWatermark(ctx);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

// ============================================================
// Code GIF Renderer (typing effect)
// ============================================================
function renderCodeGif(spec) {
  const lines = spec.lines || [];
  const TOTAL_FRAMES = Math.max(40, lines.length * 5 + 15);
  const DELAY = 100;

  const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', false);
  encoder.setDelay(DELAY);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const tokenColors = {
    keyword: '#c678dd',
    string: '#98c379',
    type: '#e5c07b',
    function: '#61afef',
    comment: '#5c6370',
    default: '#abb2bf',
  };

  const editorTop = 50;
  const lineHeight = 22;
  const codeStartX = 60;
  const gutterWidth = 45;
  const codeFont = '14px Menlo, Monaco, Courier New, monospace';

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    // Editor background -- match blog code-snippet background: #151515
    ctx.fillStyle = '#151515';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title bar
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, WIDTH, 35);
    // Traffic lights
    ctx.fillStyle = '#e06c75'; ctx.beginPath(); ctx.arc(18, 17, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e5c07b'; ctx.beginPath(); ctx.arc(38, 17, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#98c379'; ctx.beginPath(); ctx.arc(58, 17, 6, 0, Math.PI * 2); ctx.fill();
    // Filename
    ctx.font = '12px Menlo, Monaco, Courier New, monospace';
    ctx.fillStyle = '#abb2bf';
    ctx.textAlign = 'center';
    ctx.fillText(spec.filename || 'index.ts', WIDTH / 2, 21);

    // Gutter
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 35, gutterWidth, HEIGHT - 35);

    for (let i = 0; i < lines.length; i++) {
      const lineAppearFrame = i * 4 + 3;
      if (frame < lineAppearFrame) continue;

      const typeProgress = Math.min(1, (frame - lineAppearFrame) / 3);
      const y = editorTop + i * lineHeight;
      if (y > HEIGHT - 20) break;

      // Line number
      ctx.font = '12px Menlo, Monaco, Courier New, monospace';
      ctx.fillStyle = '#495162';
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), gutterWidth - 8, y);

      const line = lines[i];
      const indent = (line.indent || 0) * 20;
      let xPos = codeStartX + indent;
      ctx.textAlign = 'left';
      ctx.font = codeFont;

      const tokens = line.tokens || [];
      if (tokens.length === 0) continue;

      const fullText = tokens.map(t => t.text).join('');
      const visibleChars = Math.floor(fullText.length * typeProgress);
      let charsSoFar = 0;

      for (const token of tokens) {
        if (charsSoFar >= visibleChars) break;
        const remainingVisible = visibleChars - charsSoFar;
        const visibleText = token.text.substring(0, remainingVisible);
        ctx.fillStyle = tokenColors[token.type] || tokenColors.default;
        ctx.fillText(visibleText, xPos, y);
        xPos += ctx.measureText(visibleText).width;
        charsSoFar += token.text.length;
      }

      // Cursor blink on current typing line
      if (typeProgress < 1 && frame % 6 < 3) {
        ctx.fillStyle = '#528bff';
        ctx.fillRect(xPos, y - 12, 2, 16);
      }
    }

    // Blinking cursor at end when done
    const allDone = frame >= lines.length * 4 + 6;
    if (allDone && frame % 8 < 4) {
      const lastIdx = lines.length - 1;
      if (lastIdx >= 0) {
        const y = editorTop + lastIdx * lineHeight;
        const indent = (lines[lastIdx].indent || 0) * 20;
        let xPos = codeStartX + indent;
        ctx.font = codeFont;
        for (const token of (lines[lastIdx].tokens || [])) {
          xPos += ctx.measureText(token.text).width;
        }
        ctx.fillStyle = '#528bff';
        ctx.fillRect(xPos + 2, y - 12, 2, 16);
      }
    }

    // Watermark
    ctx.globalAlpha = 0.2;
    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#777';
    ctx.textAlign = 'right';
    ctx.fillText('neurolink.ink', WIDTH - 12, HEIGHT - 8);
    ctx.globalAlpha = 1;

    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

// ============================================================
// Main
// ============================================================
async function main() {
  const specs = JSON.parse(fs.readFileSync(SPECS_FILE, 'utf-8'));
  console.log('Rendering animated GIFs for ' + specs.length + ' posts...');

  let success = 0;
  let errors = 0;
  let total = 0;

  for (const entry of specs) {
    const slug = entry.slug;
    const outDir = path.join(BLOG_ASSETS_DIR, slug);

    for (const gif of (entry.gifs || [])) {
      total++;
      const outFile = path.join(outDir, gif.name + '.gif');

      try {
        fs.mkdirSync(outDir, { recursive: true });

        let data;
        if (gif.type === 'architecture') {
          data = renderArchitectureGif(gif);
        } else if (gif.type === 'concept') {
          data = renderConceptGif(gif);
        } else if (gif.type === 'code') {
          data = renderCodeGif(gif);
        } else {
          console.error('  Unknown type: ' + gif.type + ' for ' + slug + '/' + gif.name);
          errors++;
          continue;
        }

        fs.writeFileSync(outFile, data);
        success++;

        if (success % 10 === 0) {
          console.log('  [' + success + '/' + total + '] rendered...');
        }
      } catch (err) {
        console.error('  ERROR [' + slug + '/' + gif.name + ']: ' + err.message);
        errors++;
      }
    }
  }

  console.log('\nDone! ' + success + ' animated GIFs rendered, ' + errors + ' errors out of ' + total + ' total.');

  // Verify uniqueness + format
  const crypto = require('crypto');
  const hashes = new Set();
  const files = [];
  let validGifs = 0;

  for (const entry of specs) {
    for (const gif of (entry.gifs || [])) {
      const fp = path.join(BLOG_ASSETS_DIR, entry.slug, gif.name + '.gif');
      if (fs.existsSync(fp)) {
        const buf = fs.readFileSync(fp);
        hashes.add(crypto.createHash('md5').update(buf).digest('hex'));
        files.push(fp);
        if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) validGifs++;
      }
    }
  }

  console.log('Uniqueness: ' + hashes.size + ' unique out of ' + files.length + ' GIF files');
  console.log('Valid GIF format: ' + validGifs + '/' + files.length);
}

main().catch(console.error);
