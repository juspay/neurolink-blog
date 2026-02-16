# NeuroLink Blog — Claude Code Instructions

## Project Overview

Jekyll blog using Chirpy theme, deployed to blog.neurolink.ink via GitHub Pages.
Branch: `release`. 135 posts in `_posts/`. Hero images in `assets/img/posts/`.

## Key Conventions

- **Post filenames:** `_posts/YYYY-MM-DD-slug.md`
- **Front matter:** Single-quoted titles, YAML array categories/tags, `>-` descriptions
- **Related posts:** Every post ends with `**Related posts:**` section (1-3 links, `/posts/slug/` format)
- **Chronological rule:** Links only reference posts dated on or before the linking post
- **Title matching:** Related post link text must exactly match target's `title:` front matter (use `yaml.safe_load` for proper parsing, not regex — handles `''` escaping and `>-` multiline)
- **No orphans:** Every post (except welcome) must be linked from at least one other post's Related section

## Quality Gate System

### Gate 1: Basic Audit (8 checks)

```bash
python3 tools/audit_posts.py
```

**Expected output (all must PASS):**
```
CHECK 1. FRONT MATTER VALIDITY    — PASS | 135/135
CHECK 2. IMAGE PATH EXISTS        — PASS | 135/135
CHECK 3. NO DUPLICATE H1          — PASS | 135/135
CHECK 4. NO PUBLISHED CALLOUT     — PASS | 135/135
CHECK 5. CODE BLOCK BALANCE       — PASS | 135/135
CHECK 6. MERMAID VALIDITY         — PASS | 135/135
CHECK 7. LIQUID SYNTAX            — PASS | 135/135
CHECK 8. TONE/VOICE CHECK         — PASS | 135/135
```

### Gate 2: Comprehensive Verification (21 checks + cross-post)

```bash
python3 tools/verify_all.py
```

**Expected output — look for these lines at the end:**
```
  OVERALL VERDICT: ALL PASS

  Cross-Post Checks:
    Broken slugs:        0
    Mismatched titles:   0  (or small number — see note below)
    Orphan posts:        0
    Inline future links: 0
```

**Known issue:** verify_all.py's built-in YAML parser does not handle `>-` multiline titles correctly. It may report a small number of "mismatched titles" that are false positives. To confirm they are false positives, run this check:

```python
python3 -c "
import yaml, re, os
from collections import defaultdict
POSTS_DIR = '_posts'
slug_to_title = {}
for f in sorted(os.listdir(POSTS_DIR)):
    if not f.endswith('.md'): continue
    m = re.match(r'\d{4}-\d{2}-\d{2}-(.+)\.md', f)
    if not m: continue
    with open(f'{POSTS_DIR}/{f}') as fh:
        content = fh.read()
    fm_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if fm_match:
        try:
            fm = yaml.safe_load(fm_match.group(1))
            if isinstance(fm, dict) and 'title' in fm:
                slug_to_title[m.group(1)] = str(fm['title'])
        except: pass
mismatches = []
for f in sorted(os.listdir(POSTS_DIR)):
    if not f.endswith('.md'): continue
    with open(f'{POSTS_DIR}/{f}') as fh:
        content = fh.read()
    rp = re.search(r'\*\*Related posts:\*\*\s*\n((?:\s*-\s*\[[^\]]+\]\([^\)]+\)\s*\n?)+)', content)
    if not rp: continue
    for lm in re.finditer(r'\[([^\]]+)\]\(/posts/([^/]+)/\)', rp.group(1)):
        exp = slug_to_title.get(lm.group(2))
        if exp and lm.group(1) != exp:
            mismatches.append(f'{f}: link=\"{lm.group(1)}\" vs title=\"{exp}\"')
print(f'Real mismatches: {len(mismatches)}')
for m in mismatches: print(f'  {m}')
"
```

### Gate 3: Mermaid Diagram Validation

```bash
./scripts/validate-mermaid.sh
```

Exit code 0 = all valid.

### Gate 4: Cross-Post Consistency (Orphan & Link Audit)

Run this after any changes to Related posts sections:

```python
python3 -c "
import re, os
from collections import defaultdict
incoming = defaultdict(int)
all_slugs = set()
for f in sorted(os.listdir('_posts')):
    if not f.endswith('.md'): continue
    m = re.match(r'\d{4}-\d{2}-\d{2}-(.+)\.md', f)
    if m: all_slugs.add(m.group(1))
    with open(f'_posts/{f}') as fh:
        c = fh.read()
    rp = re.search(r'\*\*Related posts:\*\*\s*\n((?:\s*-\s*\[[^\]]+\]\([^\)]+\)\s*\n?)+)', c)
    if not rp: continue
    for lm in re.finditer(r'\[([^\]]+)\]\(/posts/([^/]+)/\)', rp.group(1)):
        incoming[lm.group(2)] += 1
orphans = [s for s in all_slugs if incoming.get(s, 0) == 0 and s != 'welcome-to-neurolink-blog']
print(f'Total posts: {len(all_slugs)}')
print(f'Orphan posts: {len(orphans)}')
for s in sorted(orphans): print(f'  - {s}')
print(f'Top linked: {sorted(incoming.items(), key=lambda x: -x[1])[:5]}')
"
```

**Expected:** `Orphan posts: 0`

### Gate 5: CI Pipeline (Automatic)

On push to `release`, GitHub Actions runs:
1. markdownlint (`.markdownlint.json` rules)
2. Mermaid validation (`scripts/validate-mermaid.sh`)
3. Jekyll build (`JEKYLL_ENV=production`)
4. html-proofer (internal link checking)

### Full Quality Gate Command (Run All Gates)

```bash
python3 tools/audit_posts.py && \
python3 tools/verify_all.py && \
./scripts/validate-mermaid.sh && \
echo "ALL QUALITY GATES PASSED"
```

## Independent Verification Prompt

Copy-paste this prompt to a separate Claude agent for independent "second pair of eyes" verification. The agent should run every check from scratch against actual files on disk. Do not trust prior results.

---

### COMPREHENSIVE BLOG QUALITY VERIFICATION PROMPT

#### Context

You are verifying a Jekyll blog (Chirpy theme) at the current working directory.
The blog has 135 markdown posts in `_posts/` directory. Your job is to independently
verify EVERY claim by running checks from scratch. Do NOT trust any prior results.
Verify everything yourself.

---

#### PHASE 1: Environment & File Inventory

##### 1.1 Post Count
- Verify exactly 135 `.md` files exist in `_posts/`
- List any files that are NOT `.md` format
- Verify all filenames match pattern: `YYYY-MM-DD-slug.md`
- Verify date portions are valid dates (no Feb 30, etc.)

##### 1.2 Slug-to-Date Mapping
- Build a complete mapping of every post's URL slug to its filename date
- Example: `welcome-to-neurolink-blog` → `2025-06-04`
- Verify no duplicate slugs exist
- Report the date range (earliest post to latest post)

##### 1.3 Asset Verification
- For each post that references images in front matter (`image.path`), verify the file exists on disk at the path specified
- Check `assets/img/posts/` directory structure matches what posts reference

---

#### PHASE 2: Front Matter Checks (Checks 1-2, 9-10, 19-21)

For EVERY post, verify:

##### Check #1: Required Front Matter Fields
All these fields must exist and be non-empty:
- `layout` (must be `post`)
- `title` (non-empty string)
- `date` (valid datetime with timezone)
- `categories` (list with at least 1 item)
- `tags` (list with at least 1 item)
- `author` (must be `neurolink`)
- `description` (non-empty string)
- `toc` (must be present)

##### Check #2: Image Configuration
- `image.path` must exist and point to a real file on disk
- `image.alt` must exist and be non-empty (Check #20)

##### Check #9: TOC Enabled
- `toc: true` must be set for ALL posts
- **EXCEPTION**: `2025-06-04-welcome-to-neurolink-blog.md` may have `toc: false`

##### Check #10: Pin Field Present
- `pin:` field must exist in front matter (value can be `true` or `false`)

##### Check #19: Valid Date Format
- `date:` field must contain a valid ISO date: `YYYY-MM-DD HH:MM:SS +NNNN`
- The date in the front matter must match the date prefix in the filename

##### Check #21: Description Length
- The `description` field must be at least 50 characters long
- Concatenate multi-line YAML descriptions (using `>-` or `>`) before measuring

**Output format for Phase 2:**

```
PHASE 2 RESULTS:
  Check #1  (front matter):    PASS/FAIL — X/135 pass, list failures
  Check #2  (image path):      PASS/FAIL — X/135 pass, list failures
  Check #9  (toc: true):       PASS/FAIL — X/135 pass, list failures
  Check #10 (pin present):     PASS/FAIL — X/135 pass, list failures
  Check #19 (date format):     PASS/FAIL — X/135 pass, list failures
  Check #20 (image.alt):       PASS/FAIL — X/135 pass, list failures
  Check #21 (description):     PASS/FAIL — X/135 pass, list failures
```

---

#### PHASE 3: Content Structure Checks (Checks 3-6, 11-12, 14)

For EVERY post, verify:

##### Check #3: No Duplicate H1
- No `# Heading` (H1) lines in the body content (outside code blocks)
- The title comes from front matter; body should only use `##` and below
- MUST strip code blocks before checking

##### Check #4: No Published Callout
- No lines matching `> **Published` anywhere in the body

##### Check #5: Code Block Balance
- Count all `` ``` `` fence markers in the body
- The count MUST be even (every opening has a closing)

##### Check #6: Mermaid Consistency
- If front matter has `mermaid: true`, body MUST contain at least one `` ```mermaid `` block
- If body contains a `` ```mermaid `` block, front matter MUST have `mermaid: true`

##### Check #11: Body Length (>= 200 lines)
- Count lines in the body (everything after the closing `---` of front matter)
- Must be >= 200 lines
- **EXCEPTION**: `2025-06-04-welcome-to-neurolink-blog.md` is exempt

##### Check #12: Multiple H2 Headings
- Body must contain at least 2 `## Heading` lines
- **EXCEPTION**: `2025-06-04-welcome-to-neurolink-blog.md` is exempt

##### Check #14: Has Code Blocks
- Body must contain at least one pair of `` ``` `` fences
- **EXCEPTION**: `2025-06-04-welcome-to-neurolink-blog.md` is exempt

**Output format for Phase 3:**

```
PHASE 3 RESULTS:
  Check #3  (no H1):           PASS/FAIL — X/135 pass, list failures
  Check #4  (no Published):    PASS/FAIL — X/135 pass, list failures
  Check #5  (code balance):    PASS/FAIL — X/135 pass, list failures
  Check #6  (mermaid):         PASS/FAIL — X/135 pass, list failures
  Check #11 (body length):     PASS/FAIL — X/135 pass, list failures
  Check #12 (multiple H2):     PASS/FAIL — X/135 pass, list failures
  Check #14 (has code):        PASS/FAIL — X/135 pass, list failures
```

---

#### PHASE 4: Content Quality Checks (Checks 7-8, 13, 15, 18)

##### Check #7: Liquid Syntax Safety
- No `{{` or `{%` tags outside of code blocks AND `{% raw %}...{% endraw %}` blocks
- EXCEPTION: Legitimate Jekyll tags are allowed: `{% post_url %}`, `{% link %}`, `{% include %}`, `{% raw %}`, `{% endraw %}`, `{% highlight %}`, `{% endhighlight %}`, `{% if %}`, `{% endif %}`, `{% for %}`, `{% endfor %}`
- Strip code blocks AND raw blocks AND inline code before checking

##### Check #8: Tone/Voice
- Run `python3 tools/audit_posts.py` which checks tone against `tools/blog-visuals/src/data/tone-assignments.json`

##### Check #13: No Problematic Placeholder Text
- Search for "placeholder" (case-insensitive) in body text OUTSIDE code blocks
- These are LEGITIMATE (not failures):
  - `sk-placeholder` (example API key values)
  - `placeholder:` (Slack/HTML UI property names)
  - `placeholder token` / `placeholder tokens` (PII redaction terminology)
  - `placeholder injection` (template variable terminology)
  - `the placeholder` / `contain the placeholder` (describing system behavior)
  - `Replace the placeholder values` (documentation instructions)
- Only flag uses that indicate incomplete/draft content

##### Check #15: Internal Link Format
- All internal links to other blog posts must use the format: `/posts/slug-name/`
- NO links should use raw file paths like `./some-post.md` or `_posts/some-post.md`

##### Check #18: No Raw .md File Paths
- Search for patterns like `./anything.md` in body text outside code blocks

**Output format for Phase 4:**

```
PHASE 4 RESULTS:
  Check #7  (liquid syntax):   PASS/FAIL — X/135 pass, list failures
  Check #8  (tone/voice):      PASS/FAIL — X/135 pass, list failures
  Check #13 (placeholder):     PASS/FAIL — X/135 pass, list failures
  Check #15 (link format):     PASS/FAIL — X/135 pass, list failures
  Check #18 (no raw paths):    PASS/FAIL — X/135 pass, list failures
```

---

#### PHASE 5: Related Posts Verification (Checks 16-17) — CRITICAL

##### Check #16: Related Posts Section Exists
For EVERY post:
- Must contain the exact string `**Related posts:**` (lowercase 'p' in 'posts')
- Must NOT use `**Related Posts:**` (capital P)
- Section should be at end of post, after a `---` separator
- Should contain 1-3 markdown links in format `- [Title](/posts/slug/)`
- **EXCEPTION**: `2025-06-04-welcome-to-neurolink-blog.md` is exempt (first post)

##### Check #17: No Future-Dated Related Post Links — ZERO TOLERANCE
For EVERY post:
1. Extract the post's own date from its filename
2. Find the `**Related posts:**` section
3. Extract every `/posts/slug/` link from that section
4. Map each slug back to its filename date using the slug-to-date mapping from Phase 1
5. VERIFY: Every linked post's date must be ON OR BEFORE the linking post's date
6. If ANY link points to a post dated AFTER the current post, that is a FAILURE

Additionally, check for future-dated links in INLINE body text (not just Related posts):
- Search the full body for `/posts/slug/` links
- Verify ALL of them reference posts dated on or before the current post
- Report any inline future-dated links separately

**Output format for Phase 5:**

```
PHASE 5 RESULTS:
  Check #16 (related posts section): PASS/FAIL — X/135 pass (1 exempt), list failures
  Check #17 (no future links):       PASS/FAIL — X/135 pass, list failures

  INLINE LINK CHECK:
    Posts with inline future-dated links: [list any]
    Total inline future violations: N
```

---

#### PHASE 6: Cross-Post Consistency

##### 6.1: Slug Validity in Related Posts
- For every `/posts/slug/` link in every Related posts section, verify the slug actually exists as a real post
- A link to `/posts/nonexistent-post/` is a broken link — report it

##### 6.2: Title Accuracy in Related Posts
- For every `[Title Text](/posts/slug/)` link, verify the title text matches the actual post's `title:` field (use `yaml.safe_load` for proper YAML parsing)
- Completely wrong titles are failures

##### 6.3: Related Posts Link Count
Report the distribution:
- Posts with 1 related link: N
- Posts with 2 related links: N
- Posts with 3 related links: N
- Posts with 0 related links: N (should be 1 — only the welcome post)
- Posts with 4+ related links: N (should be 0)

##### 6.4: Orphan Check
- Identify any posts that are NEVER linked to from any other post's Related posts section
- These are "orphan" posts

**Output format for Phase 6:**

```
PHASE 6 RESULTS:
  Broken slugs (link to nonexistent post):  [list any]
  Mismatched titles:                         [list any]
  Link count distribution:                   1-link: N, 2-link: N, 3-link: N
  Orphan posts (never linked to):            [list]
```

---

#### PHASE 7: Run Existing Audit Script

Run the existing audit tool to double-check independently:

```bash
python3 tools/audit_posts.py
```

Report the full output. All 8 checks should show PASS with 135/135.

---

#### PHASE 8: Specific File Verification

These specific files had known issues that were fixed. Verify each one individually:

##### 8.1: Posts that were expanded (verify body line count >= 200)
- `2025-06-08-why-we-built-neurolink.md` — was 165 lines, expanded to 200+
- `2025-10-13-ai-sdk-landscape-2026.md` — was 183 lines, expanded to 200+
- `2025-11-06-total-cost-of-ownership.md` — was 187 lines, expanded to 200+. Also had code blocks ADDED
- `2026-02-03-open-source-neurolink.md` — was 161 lines, expanded to 200+. Also had code blocks ADDED

##### 8.2: Provider failover casing fix
- `2025-06-18-provider-failover-patterns.md` — verify it uses `**Related posts:**` (lowercase p), NOT `**Related Posts:**`

##### 8.3: CLI automation raw path fix
- `2025-09-12-cli-automation.md` — verify NO `./multimodal-document-processing.md` or similar raw `.md` path references exist

##### 8.4: Welcome post (intentionally exempt)
- `2025-06-04-welcome-to-neurolink-blog.md` — verify it does NOT have a Related posts section
- Confirm it has `toc: false` (acceptable exception)
- Confirm it's under 200 lines (acceptable exception)

##### 8.5: Posts with legitimate "placeholder" usage (should NOT be flagged)
- `2025-08-08-openai-compatible-endpoints.md` — `sk-placeholder` API key example
- `2025-08-30-enterprise-security-guide.md` — placeholder tokens for PII redaction
- `2025-10-03-debugging-ai-applications.md` — the placeholder describing guardrail output
- `2025-11-15-slack-bot-tutorial.md` — `placeholder:` Slack Block Kit property
- `2026-02-01-raw-data-to-reports-automating-bi-with-ai.md` — placeholder injection templating term

---

#### FINAL REPORT FORMAT

```
╔══════════════════════════════════════════════════════════════╗
║           NEUROLINK BLOG VERIFICATION REPORT                ║
╠══════════════════════════════════════════════════════════════╣
║ Total Posts: 135                                            ║
║ Date Range: YYYY-MM-DD to YYYY-MM-DD                       ║
╠══════════════════════════════════════════════════════════════╣
║ CHECK #  │ NAME                      │ PASS │ FAIL │ STATUS ║
║──────────┼───────────────────────────┼──────┼──────┼────────║
║  1       │ Front matter fields       │      │      │        ║
║  2       │ Image path exists         │      │      │        ║
║  3       │ No duplicate H1           │      │      │        ║
║  4       │ No Published callout      │      │      │        ║
║  5       │ Code block balance        │      │      │        ║
║  6       │ Mermaid consistency       │      │      │        ║
║  7       │ Liquid syntax safety      │      │      │        ║
║  8       │ Tone/voice check          │      │      │        ║
║  9       │ toc: true                 │      │      │        ║
║  10      │ pin: present              │      │      │        ║
║  11      │ Body >= 200 lines         │      │      │        ║
║  12      │ Multiple H2 headings      │      │      │        ║
║  13      │ No placeholder text       │      │      │        ║
║  14      │ Has code blocks           │      │      │        ║
║  15      │ Link format (/posts/slug/)│      │      │        ║
║  16      │ Related posts section     │      │      │        ║
║  17      │ No future-dated links     │      │      │        ║
║  18      │ No raw .md paths          │      │      │        ║
║  19      │ Valid date format         │      │      │        ║
║  20      │ image.alt exists          │      │      │        ║
║  21      │ Description >= 50 chars   │      │      │        ║
╠══════════════════════════════════════════════════════════════╣
║ CROSS-POST CHECKS                                           ║
║  Broken slugs:        N                                     ║
║  Mismatched titles:   N                                     ║
║  Orphan posts:        N                                     ║
║  Inline future links: N                                     ║
╠══════════════════════════════════════════════════════════════╣
║ SPECIFIC FILE CHECKS                                        ║
║  8.1 Expanded posts:     ALL PASS / FAILURES                ║
║  8.2 Casing fix:         PASS / FAIL                        ║
║  8.3 Raw path fix:       PASS / FAIL                        ║
║  8.4 Welcome exemption:  PASS / FAIL                        ║
║  8.5 Placeholder legit:  PASS / FAIL                        ║
╠══════════════════════════════════════════════════════════════╣
║ OVERALL VERDICT: ALL PASS / X FAILURES FOUND                ║
╚══════════════════════════════════════════════════════════════╝
```

For ANY failure found, provide:
1. The exact filename
2. The check number that failed
3. The specific issue (line number if applicable)
4. The exact content that caused the failure

Use multiple parallel agents to speed up verification. Split the 135 posts into
batches for parallel processing of Phases 2-5. Phases 6-8 can run as separate
parallel tasks.

**IMPORTANT:** This verification must be INDEPENDENT. Do not read or trust any
prior verification results. Run every check from scratch against the actual files
on disk.

---

## Adding a New Blog Post

See `docs/PUBLISHING-GUIDE.md` for the full step-by-step process.

Quick checklist:
1. Create `_posts/YYYY-MM-DD-slug.md` from `docs/POST-TEMPLATE.md`
2. Generate hero image: `cd tools/blog-visuals && npm run render:hero`
3. Add Related posts section (1-3 links to earlier posts)
4. Ensure at least one existing post links back to your new post (avoid orphans)
5. Run quality gates: `python3 tools/audit_posts.py && python3 tools/verify_all.py`
6. Commit and push to `release`

## File Structure

```
_posts/                  # 135 blog posts (YYYY-MM-DD-slug.md)
assets/img/posts/        # Hero images (one dir per post slug)
_includes/sidebar.html   # Sidebar with cross-site nav
_includes/js-selector.html # Mermaid theme injection
_layouts/                # post.html, default.html (with a11y)
assets/css/custom.scss   # Brand styling + mermaid themes
assets/js/custom.js      # Mermaid accessibility enhancements
tools/audit_posts.py     # Gate 1: 8-check auditor
tools/verify_all.py      # Gate 2: 21-check verifier
tools/blog-visuals/      # Hero image + GIF generation pipeline
scripts/validate-mermaid.sh  # Gate 3: mermaid syntax checker
.github/workflows/validate.yml  # Gate 5: CI pipeline
.markdownlint.json       # Markdown lint rules
.pre-commit-config.yaml  # Pre-commit hooks
docs/PUBLISHING-GUIDE.md # Full publishing guide
docs/POST-TEMPLATE.md    # Post template
```

## Common Tasks

### Fix a Related post title mismatch
Open the target post, copy its `title:` field exactly, paste as link text.

### Add a new post without creating an orphan
After adding your post, find 1-3 existing posts (dated after yours) that are
topically related, and add your post to their Related posts section. Replace
a link to an over-linked post if they already have 3 links.

### Check if a post is an orphan
```bash
grep -rl "your-post-slug" _posts/ | grep -v "your-post-slug"
```
If no results, the post is an orphan — add it to another post's Related section.
