#!/usr/bin/env node
/**
 * fix-gifs.js - Generate unique visuals for each GIF spec.
 *
 * Reads gif-specs.json and creates a unique 800x450 PNG (saved with .gif
 * extension) for every entry using sharp's SVG-overlay pipeline.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SPECS_PATH = path.resolve(__dirname, '../src/data/gif-specs.json');
const ASSETS_ROOT = path.resolve(__dirname, '../../../assets/img/posts');
const WIDTH = 800;
const HEIGHT = 450;

// ── helpers ──────────────────────────────────────────────────────────────────

/** XML-escape a string so it is safe inside SVG text elements. */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Convert hex colour to rgba with given alpha. */
function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── SVG builders ─────────────────────────────────────────────────────────────

function buildArchitectureSVG(spec) {
  const BG = '#1e1e1c';
  const GRID = '#2a2a27';
  const nodeW = 120;
  const nodeH = 42;

  let defs = '';
  let body = '';

  // background + subtle grid
  body += `<rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>`;
  for (let x = 0; x < WIDTH; x += 40) {
    body += `<line x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" stroke="${GRID}" stroke-width="0.5"/>`;
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    body += `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>`;
  }

  // title
  if (spec.title) {
    body += `<text x="${WIDTH / 2}" y="30" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold" fill="#e5e7eb">${esc(spec.title)}</text>`;
  }

  // connections (draw first so nodes sit on top)
  if (spec.connections) {
    for (const c of spec.connections) {
      const col = c.color || '#555';
      // arrow line
      body += `<line x1="${c.fromX}" y1="${c.fromY}" x2="${c.toX}" y2="${c.toY}" stroke="${col}" stroke-width="2" stroke-opacity="0.8"/>`;
      // arrowhead
      const dx = c.toX - c.fromX;
      const dy = c.toY - c.fromY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const tipX = c.toX;
      const tipY = c.toY;
      const sz = 8;
      const p1x = tipX - sz * ux + (sz / 2) * uy;
      const p1y = tipY - sz * uy - (sz / 2) * ux;
      const p2x = tipX - sz * ux - (sz / 2) * uy;
      const p2y = tipY - sz * uy + (sz / 2) * ux;
      body += `<polygon points="${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}" fill="${col}" opacity="0.9"/>`;
      // glow dot at midpoint
      const mx = (c.fromX + c.toX) / 2;
      const my = (c.fromY + c.toY) / 2;
      body += `<circle cx="${mx}" cy="${my}" r="4" fill="${col}" opacity="0.7"/>`;
    }
  }

  // nodes
  if (spec.nodes) {
    for (const n of spec.nodes) {
      const col = n.color || '#ff9505';
      const x = n.x;
      const y = n.y;
      // glow
      defs += `<filter id="glow-${n.id}"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
      // shadow rect
      body += `<rect x="${x - nodeW / 2 + 2}" y="${y - nodeH / 2 + 2}" width="${nodeW}" height="${nodeH}" rx="8" fill="rgba(0,0,0,0.3)"/>`;
      // main rect
      body += `<rect x="${x - nodeW / 2}" y="${y - nodeH / 2}" width="${nodeW}" height="${nodeH}" rx="8" fill="${rgba(col, 0.15)}" stroke="${col}" stroke-width="2" filter="url(#glow-${esc(n.id)})"/>`;
      // label - handle multi-line (split on \n)
      const lines = (n.label || '').split('\n');
      if (lines.length === 1) {
        body += `<text x="${x}" y="${y + 5}" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="${col}">${esc(lines[0])}</text>`;
      } else {
        const lineH = 14;
        const startY = y - ((lines.length - 1) * lineH) / 2 + 4;
        for (let i = 0; i < lines.length; i++) {
          body += `<text x="${x}" y="${startY + i * lineH}" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="${col}">${esc(lines[i])}</text>`;
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs>${defs}</defs>${body}</svg>`;
}

function buildConceptSVG(spec) {
  const BG = '#1e1e1c';
  let body = '';

  body += `<rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>`;

  // title
  if (spec.concept) {
    body += `<text x="${WIDTH / 2}" y="55" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#ff9505">${esc(spec.concept)}</text>`;
    // underline accent
    const tw = spec.concept.length * 9;
    body += `<line x1="${WIDTH / 2 - tw / 2}" y1="62" x2="${WIDTH / 2 + tw / 2}" y2="62" stroke="#ff9505" stroke-width="2" opacity="0.6"/>`;
  }

  // subtitle line
  body += `<text x="${WIDTH / 2}" y="85" text-anchor="middle" font-family="monospace" font-size="11" fill="#6b7280">Step-by-step flow</text>`;

  if (spec.steps && spec.steps.length > 0) {
    // draw connecting lines between sequential steps
    for (let i = 0; i < spec.steps.length - 1; i++) {
      const s1 = spec.steps[i];
      const s2 = spec.steps[i + 1];

      // Only connect if they're in the same y-row or draw curved lines
      const x1 = s1.x + 30;
      const y1 = s1.y;
      const x2 = s2.x - 30;
      const y2 = s2.y;

      if (Math.abs(y1 - y2) < 20) {
        // Straight horizontal arrow
        body += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#444" stroke-width="2" stroke-dasharray="6,4"/>`;
        body += `<polygon points="${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}" fill="#555"/>`;
      } else {
        // Curved path
        const mx = (x1 + x2) / 2;
        body += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="#444" stroke-width="2" stroke-dasharray="6,4"/>`;
      }
    }

    // step cards
    for (let i = 0; i < spec.steps.length; i++) {
      const s = spec.steps[i];
      const x = s.x;
      const y = s.y;
      const cardW = 110;
      const cardH = 80;

      // Step number badge
      const badgeColor = `hsl(${(i * 60) % 360}, 70%, 55%)`;

      // card background
      body += `<rect x="${x - cardW / 2}" y="${y - cardH / 2}" width="${cardW}" height="${cardH}" rx="10" fill="rgba(255,255,255,0.05)" stroke="${badgeColor}" stroke-width="1.5"/>`;

      // icon (rendered as text fallback)
      body += `<text x="${x}" y="${y - 8}" text-anchor="middle" font-size="22">${esc(s.icon || '')}</text>`;

      // label
      body += `<text x="${x}" y="${y + 18}" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="#e5e7eb">${esc(s.label)}</text>`;

      // step number
      body += `<circle cx="${x + cardW / 2 - 8}" cy="${y - cardH / 2 + 8}" r="9" fill="${badgeColor}"/>`;
      body += `<text x="${x + cardW / 2 - 8}" y="${y - cardH / 2 + 12}" text-anchor="middle" font-family="monospace" font-size="9" font-weight="bold" fill="#fff">${i + 1}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${body}</svg>`;
}

function buildCodeSVG(spec) {
  const BG = '#1e1e1c';
  const TAB_BG = '#2a2a27';
  const LINE_H = 22;
  const INDENT_PX = 20;
  const PAD_LEFT = 60; // room for line numbers
  const PAD_TOP = 65;  // room for tab bar

  const colorMap = {
    keyword: '#ec4e20',
    string: '#22c55e',
    function: '#a855f7',
    type: '#3b82f6',
    comment: '#6b7280',
    default: '#e5e7eb',
  };

  let body = '';

  // Editor chrome
  body += `<rect width="${WIDTH}" height="${HEIGHT}" rx="8" fill="${BG}"/>`;
  // tab bar
  body += `<rect x="0" y="0" width="${WIDTH}" height="38" rx="8" fill="${TAB_BG}"/>`;
  body += `<rect x="0" y="20" width="${WIDTH}" height="18" fill="${TAB_BG}"/>`;
  // window dots
  body += `<circle cx="18" cy="18" r="6" fill="#ef4444"/>`;
  body += `<circle cx="38" cy="18" r="6" fill="#f59e0b"/>`;
  body += `<circle cx="58" cy="18" r="6" fill="#22c55e"/>`;
  // tab
  const fname = spec.filename || spec.title || 'code.ts';
  body += `<rect x="80" y="6" width="${Math.max(fname.length * 8 + 24, 100)}" height="26" rx="4" fill="${BG}"/>`;
  body += `<text x="92" y="24" font-family="monospace" font-size="12" fill="#e5e7eb">${esc(fname)}</text>`;

  // separator
  body += `<line x1="0" y1="38" x2="${WIDTH}" y2="38" stroke="#333" stroke-width="1"/>`;

  // gutter background
  body += `<rect x="0" y="38" width="45" height="${HEIGHT - 38}" fill="${TAB_BG}"/>`;

  // code lines
  if (spec.lines) {
    for (let i = 0; i < spec.lines.length; i++) {
      const line = spec.lines[i];
      const y = PAD_TOP + i * LINE_H;

      if (y > HEIGHT - 10) break;

      // line number
      body += `<text x="35" y="${y}" text-anchor="end" font-family="monospace" font-size="11" fill="#555">${i + 1}</text>`;

      // tokens
      const indent = (line.indent || 0) * INDENT_PX;
      let xPos = PAD_LEFT + indent;

      if (line.tokens && line.tokens.length > 0) {
        for (const tok of line.tokens) {
          const color = colorMap[tok.type] || colorMap.default;
          const text = esc(tok.text);
          body += `<text x="${xPos}" y="${y}" font-family="monospace" font-size="12" fill="${color}">${text}</text>`;
          // Approximate character width for monospace at 12px ~ 7.2px
          xPos += tok.text.length * 7.2;
        }
      }

      // highlight bar for non-empty lines
      if (line.tokens && line.tokens.length > 0) {
        body += `<rect x="46" y="${y - 13}" width="${WIDTH - 46}" height="${LINE_H}" fill="rgba(255,255,255,0.02)" rx="2"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${body}</svg>`;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const specs = JSON.parse(fs.readFileSync(SPECS_PATH, 'utf-8'));

  let total = 0;
  let generated = 0;
  const errors = [];

  for (const post of specs) {
    const slug = post.slug;
    const outDir = path.join(ASSETS_ROOT, slug);

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    for (const gif of post.gifs) {
      total++;
      const outFile = path.join(outDir, `${gif.name}.gif`);

      try {
        let svg;
        switch (gif.type) {
          case 'architecture':
            svg = buildArchitectureSVG(gif);
            break;
          case 'concept':
            svg = buildConceptSVG(gif);
            break;
          case 'code':
            svg = buildCodeSVG(gif);
            break;
          default:
            throw new Error(`Unknown type: ${gif.type}`);
        }

        await sharp(Buffer.from(svg))
          .png()
          .toFile(outFile);

        generated++;
        process.stdout.write(`  [${generated}/${total}] ${slug}/${gif.name}.gif\n`);
      } catch (err) {
        errors.push({ slug, name: gif.name, error: err.message });
        process.stderr.write(`  ERROR: ${slug}/${gif.name}: ${err.message}\n`);
      }
    }
  }

  console.log(`\nDone: ${generated}/${total} generated, ${errors.length} errors.`);
  if (errors.length > 0) {
    console.log('Errors:');
    for (const e of errors) {
      console.log(`  - ${e.slug}/${e.name}: ${e.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
