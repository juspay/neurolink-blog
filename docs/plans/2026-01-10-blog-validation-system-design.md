# Blog Validation System Design

**Date:** 2026-01-10
**Status:** Proposed

## Problem Summary

The Neurolink blog has multiple issues that go undetected until runtime:

| Issue | Count | Impact |
|-------|-------|--------|
| Broken documentation links | 15+ | Readers get 404 errors |
| Mermaid diagrams | 11 | No syntax validation, could break silently |
| No CI/CD pipeline | - | Everything is manual |
| Unpinned Mermaid CDN | - | Could break without warning |
| Missing .gitignore | - | Build artifacts in repo |

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Validation Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOCAL (pre-commit)           CI (GitHub Actions)               │
│  ┌─────────────────┐         ┌─────────────────────────────┐   │
│  │ 1. Markdown lint│         │ 1. Build Jekyll site        │   │
│  │ 2. YAML lint    │         │ 2. Lint markdown            │   │
│  │ 3. Front matter │         │ 3. Validate Mermaid         │   │
│  │ 4. Mermaid check│         │ 4. Check internal links     │   │
│  └────────┬────────┘         │ 5. Check external links*    │   │
│           │                  └─────────────┬───────────────┘   │
│           │                                │                    │
│           ▼                                ▼                    │
│       git commit ──────────────────► Pull Request              │
│                                            │                    │
│                                            ▼                    │
│                                    Deploy to GitHub Pages       │
│                                                                 │
│  * External link check runs weekly on schedule                  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Foundation (Immediate Fixes)

#### 1.1 Add .gitignore

```gitignore
# Jekyll build output
_site/
.jekyll-cache/
.jekyll-metadata

# Ruby/Bundler
.bundle/
vendor/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Temporary files
*.log
tmp/
```

#### 1.2 Fix External Documentation Links

Add to `_config.yml`:
```yaml
# External site URLs
docs_url: "https://docs.neurolink.ink"
examples_url: "https://github.com/juspay/neurolink/tree/main/examples"
```

Update all posts to use `{{ site.docs_url }}` instead of bare `/docs/` paths.

#### 1.3 Pin Mermaid Version

Update `_includes/mermaid.html`:
```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose'
  });
</script>
```

#### 1.4 Conditional Mermaid Loading

Update `_layouts/post.html` to only load Mermaid when needed:
```liquid
{% if page.mermaid %}
  {% include mermaid.html %}
{% endif %}
```

Add `mermaid: true` to front matter of posts with diagrams.

---

### Phase 2: Local Validation (Pre-commit Hooks)

#### 2.1 Install Pre-commit Framework

```bash
pip install pre-commit
```

#### 2.2 Create `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
        args: [--markdown-linebreak-ext=md]
      - id: end-of-file-fixer
      - id: check-yaml
        args: [--allow-multiple-documents]
      - id: check-added-large-files
        args: ['--maxkb=1000']

  - repo: https://github.com/DavidAnson/markdownlint-cli2
    rev: v0.17.2
    hooks:
      - id: markdownlint-cli2
        args: ['--config', '.markdownlint.json']
        exclude: '^(_site|vendor)/'

  - repo: https://github.com/adrienverge/yamllint
    rev: v1.35.1
    hooks:
      - id: yamllint
        args: ['-d', '{extends: relaxed, rules: {line-length: disable}}']

  - repo: local
    hooks:
      - id: mermaid-syntax
        name: Validate Mermaid diagrams
        entry: bash scripts/validate-mermaid.sh
        language: system
        files: \.md$
        pass_filenames: true
```

#### 2.3 Create `.markdownlint.json`

```json
{
  "default": true,
  "MD013": false,
  "MD033": {
    "allowed_elements": ["div", "script", "details", "summary", "br", "sup", "sub"]
  },
  "MD025": {
    "front_matter_title": ""
  },
  "MD041": false,
  "MD024": {
    "siblings_only": true
  }
}
```

#### 2.4 Create `scripts/validate-mermaid.sh`

```bash
#!/bin/bash
set -e

for file in "$@"; do
  if grep -q '```mermaid' "$file"; then
    echo "Validating Mermaid in: $file"
    npx -p @mermaid-js/mermaid-cli mmdc -i "$file" -o /tmp/mermaid-out.md 2>&1 || {
      echo "ERROR: Invalid Mermaid syntax in $file"
      exit 1
    }
  fi
done
```

---

### Phase 3: CI/CD Pipeline (GitHub Actions)

#### 3.1 Create `.github/workflows/ci.yml`

```yaml
name: Jekyll CI

on:
  push:
    branches: [main, release]
  pull_request:
    branches: [main, release]
  schedule:
    - cron: '0 0 * * 0'  # Weekly full check

permissions:
  contents: read
  pull-requests: write

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lint Markdown
        uses: DavidAnson/markdownlint-cli2-action@v19
        with:
          globs: '_posts/**/*.md'
          config: .markdownlint.json

  mermaid:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Validate Mermaid diagrams
        run: |
          npm install -g @mermaid-js/mermaid-cli
          for file in $(find _posts -name "*.md"); do
            if grep -q '```mermaid' "$file"; then
              echo "Checking: $file"
              mmdc -i "$file" -o /tmp/out.md 2>&1 || exit 1
            fi
          done

  build:
    runs-on: ubuntu-latest
    needs: [lint, mermaid]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true

      - name: Build site
        run: bundle exec jekyll build
        env:
          JEKYLL_ENV: production

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: site
          path: _site/

  links-internal:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Download site
        uses: actions/download-artifact@v4
        with:
          name: site
          path: _site/

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'

      - name: Check internal links
        run: |
          gem install html-proofer
          htmlproofer _site \
            --disable-external \
            --allow-hash-href \
            --ignore-urls "/localhost/,/127.0.0.1/"

  links-external:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4

      - name: Download site
        uses: actions/download-artifact@v4
        with:
          name: site
          path: _site/

      - name: Restore link cache
        uses: actions/cache@v4
        with:
          path: .lycheecache
          key: lychee-${{ github.sha }}
          restore-keys: lychee-

      - name: Check external links
        uses: lycheeverse/lychee-action@v2
        with:
          args: >-
            --cache --max-cache-age 7d
            --exclude linkedin.com
            --exclude twitter.com
            --exclude x.com
            --max-concurrency 5
            --timeout 30
            ./_site
          fail: false
```

#### 3.2 Create `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [release]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Build
        run: bundle exec jekyll build
        env:
          JEKYLL_ENV: production

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy
        uses: actions/deploy-pages@v4
```

---

### Phase 4: Add Validation Tools to Gemfile

Update `Gemfile`:
```ruby
source "https://rubygems.org"

gem "jekyll", "~> 4.3"
gem "minima", "~> 2.5"

group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.12"
  gem "jekyll-seo-tag", "~> 2.8"
  gem "jekyll-sitemap", "~> 1.4"
end

group :development, :test do
  gem "html-proofer", "~> 5.0"
end
```

Create `Rakefile` for local testing:
```ruby
require 'html-proofer'

task :build do
  sh "bundle exec jekyll build"
end

task :test => :build do
  HTMLProofer.check_directory('./_site', {
    assume_extension: '.html',
    disable_external: true,
    allow_hash_href: true
  }).run
end

task :test_all => :build do
  HTMLProofer.check_directory('./_site', {
    assume_extension: '.html',
    allow_hash_href: true,
    ignore_urls: [/linkedin\.com/, /twitter\.com/],
    cache: { timeframe: { external: '7d' } }
  }).run
end

task default: :test
```

---

## What Gets Caught at Each Stage

| Issue | Pre-commit | CI Build | CI Links |
|-------|------------|----------|----------|
| Markdown formatting errors | ✅ | ✅ | - |
| YAML syntax errors | ✅ | ✅ | - |
| Mermaid syntax errors | ✅ | ✅ | - |
| Missing front matter | ✅ | ✅ | - |
| Broken `post_url` references | - | ✅ | - |
| Broken internal links | - | - | ✅ |
| Broken external links | - | - | ✅ (weekly) |
| Missing images | - | - | ✅ |
| Large file additions | ✅ | - | - |

---

## Files to Create/Modify

### New Files
- `.gitignore`
- `.pre-commit-config.yaml`
- `.markdownlint.json`
- `scripts/validate-mermaid.sh`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `Rakefile`
- `.lycheeignore`

### Modified Files
- `_config.yml` - Add `docs_url`, `examples_url`
- `Gemfile` - Add `html-proofer`
- `_includes/mermaid.html` - Pin version
- `_layouts/post.html` - Conditional mermaid loading
- `_posts/*.md` - Fix documentation links, add `mermaid: true`

---

## Estimated Effort

| Phase | Tasks | Complexity |
|-------|-------|------------|
| Phase 1 | Foundation fixes | Low |
| Phase 2 | Pre-commit setup | Medium |
| Phase 3 | GitHub Actions | Medium |
| Phase 4 | Gemfile + Rakefile | Low |

---

## Next Steps

1. Review and approve this plan
2. Execute Phase 1 (immediate fixes)
3. Execute Phase 2-4 (validation infrastructure)
4. Fix existing broken links in posts
5. Test the complete pipeline
