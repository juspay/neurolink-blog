const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PROMPTS_FILE = path.resolve(__dirname, '../src/data/hero-prompts.json');
const BLOG_ASSETS_DIR = path.resolve(__dirname, '../../../assets/img/posts');

const colors = {
  tutorial: '#016fb9',
  'deep-dive': '#0190e0',
  comparison: '#ff9505',
  opinion: '#ec4e20',
  announcement: '#ff9505',
  beginner: '#22c55e',
};

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTitle(title, maxChars) {
  maxChars = maxChars || 38;
  var words = title.split(' ');
  var lines = [];
  var currentLine = '';
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (currentLine.length > 0 && (currentLine + ' ' + word).length > maxChars) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.slice(0, 3);
}

function createSvg(title, category) {
  var accentColor = colors[category] || '#016fb9';
  var borderColor = category === 'deep-dive' ? '#0190e0' : accentColor;
  var escTitle = escapeXml(title);
  var lines = wrapTitle(escTitle);
  var rawLabel = category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');
  var categoryLabel = escapeXml(rawLabel.toUpperCase());

  var titleY = 280;
  var lineHeight = 55;
  var titleLines = lines.map(function(line, i) {
    return '<text x="60" y="' + (titleY + i * lineHeight) + '" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="bold" fill="white">' + line + '</text>';
  }).join('\n    ');

  var badgeWidth = rawLabel.length * 11 + 36;
  var dividerY = titleY + lines.length * lineHeight + 25;

  return '<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">\n'
    + '  <defs>\n'
    + '    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">\n'
    + '      <stop offset="0%" stop-color="#2a2a27"/>\n'
    + '      <stop offset="50%" stop-color="#353531"/>\n'
    + '      <stop offset="100%" stop-color="#2a2a27"/>\n'
    + '    </linearGradient>\n'
    + '    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">\n'
    + '      <stop offset="0%" stop-color="' + accentColor + '"/>\n'
    + '      <stop offset="100%" stop-color="' + accentColor + '66"/>\n'
    + '    </linearGradient>\n'
    + '  </defs>\n'
    + '  <rect width="1200" height="630" fill="url(#bg)"/>\n'
    + '  <rect width="1200" height="6" fill="url(#accent)"/>\n'
    + '  <circle cx="1050" cy="120" r="80" fill="' + accentColor + '" opacity="0.08"/>\n'
    + '  <circle cx="1100" cy="180" r="120" fill="' + accentColor + '" opacity="0.05"/>\n'
    + '  <circle cx="980" cy="80" r="40" fill="' + accentColor + '" opacity="0.06"/>\n'
    + '  <circle cx="150" cy="520" r="60" fill="' + accentColor + '" opacity="0.06"/>\n'
    + '  <line x1="0" y1="160" x2="1200" y2="160" stroke="' + accentColor + '" stroke-width="0.5" opacity="0.05"/>\n'
    + '  <line x1="0" y1="320" x2="1200" y2="320" stroke="' + accentColor + '" stroke-width="0.5" opacity="0.05"/>\n'
    + '  <rect x="0" y="180" width="4" height="280" fill="' + borderColor + '" rx="2"/>\n'
    + '  <rect x="60" y="200" width="' + badgeWidth + '" height="34" rx="6" fill="' + accentColor + '"/>\n'
    + '  <text x="' + (60 + badgeWidth / 2) + '" y="222" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="1.5">' + categoryLabel + '</text>\n'
    + '  ' + titleLines + '\n'
    + '  <rect x="60" y="' + dividerY + '" width="180" height="3" fill="' + accentColor + '" opacity="0.5" rx="1"/>\n'
    + '  <text x="60" y="592" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#777" letter-spacing="0.5">neurolink.ink/blog</text>\n'
    + '  <circle cx="1120" cy="582" r="22" fill="' + accentColor + '" opacity="0.15"/>\n'
    + '  <text x="1108" y="588" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="' + accentColor + '" opacity="0.8">NL</text>\n'
    + '</svg>';
}

async function main() {
  var prompts = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
  console.log('Generating ' + prompts.length + ' hero images...');

  var success = 0;
  var errors = 0;

  for (var i = 0; i < prompts.length; i++) {
    var slug = prompts[i].slug;
    var title = prompts[i].title;
    var tone = prompts[i].tone;
    var outDir = path.join(BLOG_ASSETS_DIR, slug);
    var outFile = path.join(outDir, 'hero.png');

    try {
      fs.mkdirSync(outDir, { recursive: true });
      var svg = createSvg(title, tone);
      await sharp(Buffer.from(svg)).png().toFile(outFile);
      success++;
      if ((i + 1) % 20 === 0) {
        console.log('  [' + (i + 1) + '/' + prompts.length + '] done...');
      }
    } catch (err) {
      console.error('  ERROR [' + slug + ']: ' + err.message);
      errors++;
    }
  }

  console.log('\nDone! ' + success + ' heroes generated, ' + errors + ' errors.');

  // Verify uniqueness
  var hashes = new Set();
  var crypto = require('crypto');
  for (var j = 0; j < Math.min(10, prompts.length); j++) {
    var buf = fs.readFileSync(path.join(BLOG_ASSETS_DIR, prompts[j].slug, 'hero.png'));
    hashes.add(crypto.createHash('md5').update(buf).digest('hex'));
  }
  console.log('Uniqueness check: ' + hashes.size + ' unique images out of 10 sampled');
}

main().catch(console.error);
