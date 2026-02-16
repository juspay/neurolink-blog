# NeuroLink Blog

Technical blog for [NeuroLink](https://github.com/juspay/neurolink) — the unified AI SDK by Juspay.

**Live site:** [blog.neurolink.ink](https://blog.neurolink.ink)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Static site generator | [Jekyll](https://jekyllrb.com/) |
| Theme | [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) v7.4 |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |
| Comments | [Giscus](https://giscus.app/) (GitHub Discussions) |
| Analytics | Google Analytics |
| Diagrams | [Mermaid.js](https://mermaid.js.org/) |
| Linting | [markdownlint](https://github.com/DavidAnson/markdownlint) |

## Prerequisites

- **Ruby** 3.3+ with Bundler
- **Node.js** 20+ (for markdownlint)
- **Python** 3.x (for quality gate scripts)
- **Git**

## Local Development

```bash
# Clone the repository
git clone https://github.com/juspay/neurolink-blog.git
cd neurolink-blog

# Install Ruby dependencies
bundle install

# Serve locally with live reload
bundle exec jekyll serve --livereload

# Site is available at http://localhost:4000
```

## Project Structure

```text
neurolink-blog/
├── _posts/                         # Blog posts (YYYY-MM-DD-slug.md)
├── _tabs/                          # Navigation pages (about, archives, categories, tags)
├── _includes/
│   ├── sidebar.html                # Custom sidebar with cross-site navigation
│   └── js-selector.html            # Mermaid dark/light theme injection
├── _layouts/
│   ├── default.html                # Base layout with accessibility enhancements
│   └── post.html                   # Post layout
├── assets/
│   ├── css/custom.scss             # Brand styling (NeuroLink colors, fonts)
│   ├── js/custom.js                # Mermaid accessibility enhancements
│   └── img/posts/                  # Hero images (one directory per post slug)
├── tools/
│   ├── audit_posts.py              # Quality gate 1: 8 fundamental checks
│   ├── verify_all.py               # Quality gate 2: 21 comprehensive checks
│   ├── verify-mermaid-all.js       # Mermaid syntax validator (Node.js)
│   └── blog-visuals/               # Hero image and GIF generation pipeline
├── scripts/
│   └── validate-mermaid.sh         # Shell wrapper for Mermaid validation
├── docs/
│   ├── PUBLISHING-GUIDE.md         # Complete guide for writing new posts
│   └── POST-TEMPLATE.md            # Template file for new posts
├── .github/workflows/
│   └── validate.yml                # CI pipeline (lint, validate, build)
├── .markdownlint.json              # Markdown linting rules
├── .pre-commit-config.yaml         # Pre-commit hooks configuration
├── _config.yml                     # Jekyll site configuration
├── Gemfile                         # Ruby dependencies
├── CLAUDE.md                       # AI assistant instructions and quality gate docs
└── README.md                       # This file
```

## Adding a New Blog Post

### Quick Start

```bash
# 1. Copy the template
cp docs/POST-TEMPLATE.md _posts/$(date +%Y-%m-%d)-your-post-slug.md

# 2. Edit the post (see front matter format below)

# 3. Generate hero image
cd tools/blog-visuals && npm run render:hero && cd ../..

# 4. Validate
python3 tools/audit_posts.py && python3 tools/verify_all.py

# 5. Commit and push
git add _posts/YYYY-MM-DD-your-post-slug.md assets/img/posts/your-post-slug/
git commit -m "feat(blog): add post on <topic>"
git push origin release
```

### Front Matter Format

Every post requires this front matter structure:

```yaml
---
layout: post
title: 'Your Post Title Here'
date: 'YYYY-MM-DD 10:00:00 +0530'
categories:
  - Tutorial
  - Integration
tags:
  - neurolink
  - typescript
  - your-topic
author: neurolink
description: >-
  A compelling description of at least 50 characters that summarizes
  the post for SEO and social sharing.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/your-post-slug/hero.png
  alt: 'Your Post Title Here'
---
```

**All fields are mandatory.** Key rules:

| Field | Requirement |
|-------|-------------|
| `title` | Single-quoted string. Used for cross-linking — must be exact. |
| `date` | Must match the filename date prefix. Timezone `+0530` (IST). |
| `categories` | 1-2 items from: Tutorial, Guide, Integration, Comparison, Architecture, Strategy, Deep Dive, Industry, Case Study, Agents, Thought Leadership, Open Source, Release Notes, Community |
| `tags` | 3-8 lowercase, hyphenated items |
| `author` | Always `neurolink` |
| `description` | Use `>-` for multiline. Minimum 50 characters. |
| `toc` | Always `true` (exception: welcome post) |
| `mermaid` | `true` only if the post contains `` ```mermaid `` code blocks |
| `pin` | `false` unless you want the post pinned to the homepage |
| `image.path` | Points to `/assets/img/posts/<slug>/hero.png` |
| `image.alt` | Non-empty accessible alt text |

### Content Requirements

- **Minimum 200 lines** of body content (below front matter)
- **At least 2 `##` headings** — body uses `##` and below only (no `#` H1)
- **At least 1 code block** with a language identifier
- **No future-dated links** — only reference posts dated on or before your post

### Related Posts Section

Every post (except the welcome post) must end with a Related posts section:

```markdown
---

**Related posts:**

- [Exact Title of Target Post](/posts/target-post-slug/)
- [Another Post Title](/posts/another-slug/)
```

Rules:

- 1-3 links maximum
- Link text must **exactly match** the target post's `title:` front matter
- URLs use `/posts/<slug>/` format
- Only link to posts dated on or before your post
- Ensure your new post is linked from at least one existing post (no orphans)

### Mermaid Diagrams

If your post includes Mermaid diagrams:

1. Set `mermaid: true` in front matter
2. Use fenced code blocks with the `mermaid` language identifier
3. Quote parentheses in node labels: `A["Node (with parens)"]`

### Hero Images

Every post needs a hero image at `assets/img/posts/<slug>/hero.png`:

```bash
cd tools/blog-visuals
npm run generate:manifest
npm run generate:prompts
npm run render:hero
```

This generates a branded 1200x630px image with the NeuroLink color scheme.

## Quality Gates

The blog uses a multi-layer validation system. **All gates must pass before merging.**

### Gate 1: Basic Audit (8 checks)

```bash
python3 tools/audit_posts.py
```

Checks: front matter validity, image paths, no H1 duplicates, no stale callouts, code block balance, Mermaid consistency, Liquid syntax safety, tone/voice.

### Gate 2: Comprehensive Verification (21 checks)

```bash
python3 tools/verify_all.py
```

Checks everything in Gate 1 plus: TOC enabled, pin present, body length (200+ lines), multiple H2 headings, no placeholder text, code blocks present, link format, related posts section, no future-dated links, no raw `.md` paths, date format, image alt text, description length.

Also runs cross-post consistency checks: broken slugs, mismatched titles, orphan posts.

### Gate 3: Mermaid Validation

```bash
./scripts/validate-mermaid.sh
```

Validates all Mermaid diagram syntax across all posts.

### Gate 4: Full Pipeline (run all gates)

```bash
python3 tools/audit_posts.py && \
python3 tools/verify_all.py && \
./scripts/validate-mermaid.sh && \
echo "ALL QUALITY GATES PASSED"
```

### Gate 5: CI Pipeline (automatic)

On push to `release` or PR against `release`, GitHub Actions runs:

1. **markdownlint** — enforces `.markdownlint.json` rules across all posts
2. **Mermaid validation** — validates diagram syntax
3. **Jekyll build** — builds the full site in production mode

## Pre-commit Hooks

Optional but recommended. Runs markdownlint and Mermaid validation on every commit:

```bash
pip install pre-commit
pre-commit install

# Run manually
pre-commit run --all-files
```

## Customizations

This blog extends the base Chirpy theme with:

- **Brand styling** (`assets/css/custom.scss`): NeuroLink color palette (marine blue + saffron), IBM Plex Sans / JetBrains Mono fonts, custom light/dark mode overrides
- **Cross-site navigation** (`_includes/sidebar.html`): Links to neurolink.ink, docs.neurolink.ink, and Discord
- **Mermaid theming** (`_includes/js-selector.html`): Auto-switches diagram colors between light/dark mode
- **Accessibility** (`assets/js/custom.js`): ARIA labels and keyboard navigation for Mermaid diagrams
- **Chirpy callouts**: Posts use `{: .prompt-tip }`, `{: .prompt-info }`, `{: .prompt-warning }`, `{: .prompt-danger }` for styled callout boxes

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `release` | Production branch. Deploys to blog.neurolink.ink via GitHub Pages. |
| `feat/*` | Feature branches for content batches. PR against `release`. |

## Useful Commands

```bash
# Build the site without serving
bundle exec jekyll build

# Check a single post for markdown lint issues
npx markdownlint --config .markdownlint.json _posts/YYYY-MM-DD-your-post.md

# Find orphan posts (posts nobody links to)
grep -rL "your-post-slug" _posts/ | head

# Check how many posts link to a specific slug
grep -rl "your-post-slug" _posts/ | wc -l
```

## Detailed Guides

- **[Publishing Guide](docs/PUBLISHING-GUIDE.md)** — Step-by-step instructions for writing, validating, and publishing a new post with the full 21-point quality checklist
- **[Post Template](docs/POST-TEMPLATE.md)** — Copy this file to start a new post with the correct front matter structure
- **[CLAUDE.md](CLAUDE.md)** — AI assistant instructions, quality gate documentation, and independent verification prompt

## License

Content is proprietary to [Juspay](https://juspay.in). The blog theme is based on [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) (MIT License).
