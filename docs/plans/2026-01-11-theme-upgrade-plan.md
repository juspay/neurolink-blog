# Blog Theme Upgrade Plan: Medium-Like Experience with Dark Mode

**Date:** 2026-01-11
**Status:** Awaiting Approval

---

## Executive Summary

Migrate from **Minima** theme to **Chirpy** theme to achieve a professional, Medium-like reading experience with built-in dark mode, native Mermaid support, and enhanced technical blogging features.

---

## Why Chirpy Over Alternatives

| Feature | Chirpy | Minimal Mistakes | Current (Minima) |
|---------|--------|------------------|------------------|
| **Dark Mode Toggle** | Built-in (auto + manual) | 3 dark skins, no toggle | None |
| **Mermaid Diagrams** | Native support | Manual integration | Custom include |
| **Table of Contents** | Auto-generated, sticky | Manual per-post | None |
| **Reading Time** | Built-in | Built-in | None |
| **Search** | Built-in | Lunr.js | None |
| **Code Copy Button** | Built-in | Manual setup | None |
| **PWA Support** | Yes | No | No |
| **GitHub Stars** | 9,600+ | 13,300+ | Default theme |
| **Setup Complexity** | Low (starter template) | Medium | N/A |
| **Technical Blog Focus** | Purpose-built | General purpose | General |

**Recommendation: Chirpy** - Purpose-built for technical blogs with all required features out of the box.

---

## Features We'll Get

### Core Features (Built-in)
- [x] Dark/Light mode toggle with system preference detection
- [x] Native Mermaid diagram support
- [x] Auto-generated Table of Contents (sticky sidebar)
- [x] Reading time estimates
- [x] Built-in search (Lunr.js)
- [x] Code syntax highlighting with line numbers
- [x] Copy code button
- [x] SEO optimization (Open Graph, Twitter Cards, JSON-LD)
- [x] RSS/Atom feeds
- [x] Sitemap generation
- [x] Related posts
- [x] Categories and tags with archive pages
- [x] Mobile responsive design
- [x] PWA (Progressive Web App) support

### Typography & Reading Experience
- Clean, readable typography optimized for long-form content
- ~680px content width (optimal 45-75 characters per line)
- Proper heading hierarchy
- Smooth scrolling with scroll-padding

### Code Block Features
- Language-specific syntax highlighting (Rouge)
- Line numbers (optional)
- Filename display in header
- One-click copy button
- Dark mode compatible themes

### Callout/Prompt Blocks
```markdown
> This is a tip callout
{: .prompt-tip }

> This is a warning
{: .prompt-warning }

> This is danger/error
{: .prompt-danger }

> This is info
{: .prompt-info }
```

---

## Migration Plan

### Phase 1: Setup New Theme Structure

**Step 1.1: Create new branch**
```bash
git checkout -b feature/chirpy-theme
```

**Step 1.2: Update Gemfile**
```ruby
# Remove
gem "minima", "~> 2.5"

# Add
gem "jekyll-theme-chirpy", "~> 7.4"
```

**Step 1.3: Update _config.yml**
```yaml
theme: jekyll-theme-chirpy

# Site Settings
lang: en
timezone: Asia/Kolkata  # or your timezone

# Theme mode: light, dark, or blank for auto
theme_mode: # Leave blank for auto (system preference)

# Avatar
avatar: /assets/img/avatar.png  # Create or use placeholder

# Social links
social:
  name: NeuroLink Team
  links:
    - https://github.com/juspay/neurolink
    - https://discord.gg/neurolink

# TOC settings
toc: true

# Comments (optional - giscus recommended)
comments:
  provider: giscus  # or disqus, utterances
  giscus:
    repo: # your-repo
    repo_id: # from giscus.app
    category: Announcements
    category_id: # from giscus.app

# Analytics (optional)
analytics:
  google:
    id: # GA tracking ID

# PWA - set to true for offline support
pwa:
  enabled: true
```

**Step 1.4: Install dependencies**
```bash
bundle install
```

### Phase 2: Content Migration

**Step 2.1: Update post front matter**

Current format:
```yaml
---
layout: post
title: "Post Title"
date: 2025-01-15
categories: tutorial
author: NeuroLink Team
---
```

New Chirpy format:
```yaml
---
layout: post
title: "Post Title"
date: 2025-01-15 10:00:00 +0530
categories: [Tutorial, Integration]
tags: [openrouter, providers, api]
author: neurolink
description: "SEO description for this post"
image:
  path: /assets/img/og-openrouter-guide.png
  alt: OpenRouter Integration Guide
toc: true
mermaid: true
pin: false
---
```

**Step 2.2: Posts to update**

| Post | Changes Needed |
|------|----------------|
| `2025-01-10-welcome-to-neurolink-blog.md` | Add categories array, tags, description |
| `2025-01-15-openrouter-integration-guide.md` | Add `mermaid: true`, update categories/tags, add image |
| `2025-01-29-multimodal-document-processing.md` | Add `mermaid: true`, update categories/tags, add image |
| `2025-02-12-framework-comparison.md` | Fix date (2026→2025 or keep as future), add `mermaid: true` |

**Step 2.3: Create authors data file**

Create `_data/authors.yml`:
```yaml
neurolink:
  name: NeuroLink Team
  url: https://github.com/juspay/neurolink
```

### Phase 3: Asset Migration

**Step 3.1: Directory structure**
```
assets/
├── img/
│   ├── avatar.png          # Site avatar (new)
│   ├── favicons/           # Favicon set (new)
│   │   ├── favicon.ico
│   │   ├── apple-touch-icon.png
│   │   └── ...
│   ├── og-openrouter-guide.png      # Existing
│   ├── og-multimodal-tutorial.png   # Existing
│   ├── og-framework-comparison.png  # Existing
│   ├── multimodal-demo.gif          # Existing
│   └── openrouter-demo.gif          # Existing
```

**Step 3.2: Generate favicons**
Use [realfavicongenerator.net](https://realfavicongenerator.net/) to generate favicon set.

### Phase 4: Remove Old Theme Files

**Step 4.1: Remove custom layouts/includes (theme provides these)**
```bash
rm -rf _layouts/
rm -rf _includes/
```

Note: Mermaid is now native - no need for custom `mermaid.html`

**Step 4.2: Keep only custom assets**
- Keep `assets/img/` (your images)
- Theme provides its own CSS/JS

### Phase 5: Testing Checklist

- [ ] Dark/Light mode toggle works
- [ ] System preference detection works
- [ ] All 4 blog posts render correctly
- [ ] Mermaid diagrams render in all posts
- [ ] Code blocks have syntax highlighting
- [ ] Code copy button works
- [ ] Table of Contents appears and is sticky
- [ ] Reading time displays correctly
- [ ] Search functionality works
- [ ] Mobile responsive layout works
- [ ] External links to docs.neurolink.ink work
- [ ] Internal post_url links work
- [ ] Images load correctly
- [ ] OG images work for social sharing
- [ ] RSS feed generates correctly
- [ ] Sitemap generates correctly

### Phase 6: Optional Enhancements

**6.1: Add giscus comments (GitHub-based)**
1. Go to [giscus.app](https://giscus.app)
2. Configure for your repository
3. Add config to `_config.yml`

**6.2: Add Google Analytics**
```yaml
analytics:
  google:
    id: G-XXXXXXXXXX
```

**6.3: Custom styling (if needed)**
Create `assets/css/jekyll-theme-chirpy.scss`:
```scss
---
---

@import 'main';

// Your custom styles here
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `_data/authors.yml` | Author information |
| `assets/img/avatar.png` | Site avatar |
| `assets/img/favicons/*` | Favicon set |

### Modified Files
| File | Changes |
|------|---------|
| `Gemfile` | Switch theme gem |
| `_config.yml` | Complete rewrite for Chirpy |
| `_posts/*.md` | Update front matter |

### Deleted Files
| File | Reason |
|------|--------|
| `_layouts/post.html` | Theme provides |
| `_includes/mermaid.html` | Theme has native support |

---

## Rollback Plan

If issues arise:
```bash
git checkout release  # Return to original branch
```

The original theme and configuration remain on `release` branch.

---

## Timeline Estimate

| Phase | Tasks |
|-------|-------|
| Phase 1 | Setup theme structure |
| Phase 2 | Update all post front matter |
| Phase 3 | Migrate/create assets |
| Phase 4 | Remove old files |
| Phase 5 | Testing |
| Phase 6 | Optional enhancements |

---

## Approval Required

Please review this plan and confirm:

1. **Theme Choice:** Chirpy (recommended) or Minimal Mistakes?
2. **Comments:** Enable giscus comments? (GitHub-based, free)
3. **Analytics:** Add Google Analytics?
4. **PWA:** Enable Progressive Web App features?

Once approved, I will execute this plan using parallel subagents.
