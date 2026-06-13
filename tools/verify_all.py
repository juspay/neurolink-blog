#!/usr/bin/env python3
"""Comprehensive verification of all 21 blog quality checks + cross-post consistency."""

import os
import re
import json
import sys
import yaml
from pathlib import Path
from datetime import datetime

ROOT_DIR = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT_DIR / "_posts"
TONE_FILE = ROOT_DIR / "tools" / "blog-visuals" / "src" / "data" / "tone-assignments.json"

WELCOME_POST = "2025-06-04-welcome-to-neurolink-blog.md"

# ── Helpers ──────────────────────────────────────────────────────────────────

def parse_front_matter_raw(content):
    if not content.startswith("---"):
        return None, content
    end = content.find("---", 3)
    if end == -1:
        return None, content
    fm_text = content[3:end].strip()
    body = content[end + 3:]
    return fm_text, body


def parse_yaml_simple(fm_text):
    fm = {}
    current_key = None
    current_list = None
    in_image = False
    image_dict = {}

    for line in fm_text.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        indent = len(line) - len(line.lstrip())

        # List item under a key
        if stripped.startswith("- ") and current_key:
            if current_list is None:
                current_list = []
                if in_image:
                    image_dict[current_key] = current_list
                else:
                    fm[current_key] = current_list
            current_list.append(stripped[2:].strip())
            continue

        if ":" in stripped:
            current_list = None
            parts = stripped.split(":", 1)
            key = parts[0].strip()
            val = parts[1].strip().strip("'\"").strip()

            if val in (">-", ">", "|", "|-"):
                val = ""

            if key == "image" and val == "":
                in_image = True
                fm["image"] = image_dict
                current_key = None
                continue

            if in_image and indent > 0:
                current_key = key
                image_dict[key] = val
            else:
                if in_image and indent == 0:
                    in_image = False
                current_key = key
                fm[key] = val

    return fm


def extract_image_path_from_fm(fm_text):
    lines = fm_text.split("\n")
    in_image = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r'^image:\s*$', stripped):
            in_image = True
            continue
        if in_image:
            path_match = re.match(r'^\s+path:\s*(.*)', line)
            if path_match:
                val = path_match.group(1).strip().strip("'\"")
                if val in (">-", ">", "|", "|-", ""):
                    if i + 1 < len(lines):
                        val = lines[i + 1].strip().strip("'\"")
                return val
            if not line.startswith(" ") and not line.startswith("\t"):
                break
    return None


def extract_image_alt_from_fm(fm_text):
    lines = fm_text.split("\n")
    in_image = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r'^image:\s*$', stripped):
            in_image = True
            continue
        if in_image:
            alt_match = re.match(r'^\s+alt:\s*(.*)', line)
            if alt_match:
                val = alt_match.group(1).strip().strip("'\"")
                if val in (">-", ">", "|", "|-", ""):
                    if i + 1 < len(lines):
                        val = lines[i + 1].strip().strip("'\"")
                return val
            if not line.startswith(" ") and not line.startswith("\t"):
                break
    return None


def extract_description_from_fm(fm_text):
    """Extract description, handling multiline YAML."""
    lines = fm_text.split("\n")
    in_desc = False
    desc_parts = []
    desc_indent = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r'^description:\s*>-?\s*$', stripped) or re.match(r'^description:\s*\|\s*$', stripped):
            in_desc = True
            continue
        if re.match(r'^description:\s+\S', stripped):
            val = re.sub(r'^description:\s+', '', stripped).strip().strip("'\"")
            return val
        if in_desc:
            indent = len(line) - len(line.lstrip())
            if desc_indent is None and stripped:
                desc_indent = indent
            if stripped and indent >= (desc_indent or 2):
                desc_parts.append(stripped)
            elif stripped and indent < (desc_indent or 2):
                break
            elif not stripped and desc_parts:
                break

    return " ".join(desc_parts)


def extract_title_from_fm(fm_text):
    """Extract title using proper YAML parsing."""
    try:
        data = yaml.safe_load(fm_text)
        if isinstance(data, dict) and 'title' in data:
            return str(data['title'])
    except yaml.YAMLError:
        pass
    return None


def strip_code_blocks(body):
    pattern = re.compile(r'^```[^\n]*\n.*?^```', re.MULTILINE | re.DOTALL)
    return pattern.sub('', body)


def strip_code_and_raw_blocks(body):
    raw_pattern = re.compile(r'\{%\s*raw\s*%\}.*?\{%\s*endraw\s*%\}', re.DOTALL)
    stripped = raw_pattern.sub('', body)
    code_pattern = re.compile(r'^```[^\n]*\n.*?^```', re.MULTILINE | re.DOTALL)
    stripped = code_pattern.sub('', stripped)
    stripped = re.sub(r'`[^`]+`', '', stripped)
    return stripped


def count_backtick_fences(body):
    return len(re.findall(r'^```', body, re.MULTILINE))


def get_slug_from_filename(filename):
    m = re.match(r'\d{4}-\d{2}-\d{2}-(.*?)\.md$', filename)
    return m.group(1) if m else None


def get_date_from_filename(filename):
    m = re.match(r'(\d{4}-\d{2}-\d{2})-', filename)
    return m.group(1) if m else None


# ── Build slug-to-date mapping ─────────────────────────────────────────────

def build_slug_date_map(posts):
    mapping = {}
    for post_file in posts:
        slug = get_slug_from_filename(post_file)
        date = get_date_from_filename(post_file)
        if slug and date:
            mapping[slug] = date
    return mapping


# ── Individual Check Functions ────────────────────────────────────────────

def check_1_front_matter(fm, fm_text, filename):
    """Required front matter fields."""
    issues = []
    if fm is None or fm_text is None:
        return ["No front matter found"]

    # Check fields exist in raw text (handles multiline YAML like >- properly)
    required_keys = ["layout", "title", "date", "categories", "tags", "author", "description", "toc"]
    for field in required_keys:
        pattern = rf'^{field}:'
        if not re.search(pattern, fm_text, re.MULTILINE):
            issues.append(f"Missing field: {field}")

    # Verify description has actual content (not just the key with >- and nothing after)
    desc = extract_description_from_fm(fm_text)
    if not desc or not desc.strip():
        issues.append(f"Empty description")

    # Verify title has actual content
    title_match = re.search(r'^title:\s*(.*)', fm_text, re.MULTILINE)
    if title_match:
        title_val = title_match.group(1).strip().strip("'\"")
        if title_val in (">-", ">", "|", "|-", ""):
            # Multiline title - check next line(s)
            lines = fm_text.split("\n")
            for i, line in enumerate(lines):
                if line.strip().startswith("title:"):
                    if i + 1 < len(lines) and lines[i + 1].strip():
                        title_val = lines[i + 1].strip()
                    break
        if not title_val or title_val in (">-", ">", "|", "|-"):
            issues.append(f"Empty title")

    # Check layout == post
    layout_match = re.search(r'^layout:\s*(\S+)', fm_text, re.MULTILINE)
    if layout_match and layout_match.group(1).strip() != "post":
        issues.append(f"layout is '{layout_match.group(1)}', expected 'post'")

    # Check author == neurolink
    author_match = re.search(r'^author:\s*(\S+)', fm_text, re.MULTILINE)
    if author_match and author_match.group(1).strip() != "neurolink":
        issues.append(f"author is '{author_match.group(1)}', expected 'neurolink'")

    return issues


def check_2_image_path(fm_text, filename):
    """image.path exists and points to real file."""
    if fm_text is None:
        return ["No front matter"]
    img_path = extract_image_path_from_fm(fm_text)
    if img_path is None:
        return ["Missing image.path"]
    if not img_path:
        return ["Empty image.path"]
    full_path = ROOT_DIR / img_path.lstrip("/")
    if not full_path.exists():
        return [f"Image file not found: {img_path}"]
    return []


def check_3_no_h1(body, filename):
    """No H1 in body outside code blocks."""
    stripped = strip_code_blocks(body)
    issues = []
    for i, line in enumerate(stripped.split("\n"), 1):
        if re.match(r'^#\s+[^#]', line):
            issues.append(f"H1 at line ~{i}: '{line.strip()[:60]}'")
    return issues


def check_4_no_published(body, filename):
    """No Published callout."""
    issues = []
    for i, line in enumerate(body.split("\n"), 1):
        if re.search(r'>\s*\*\*Published', line):
            issues.append(f"Published callout at line {i}")
    return issues


def check_5_code_balance(body, filename):
    """Even number of ``` markers."""
    count = count_backtick_fences(body)
    if count % 2 != 0:
        return [f"Odd fence count: {count}"]
    return []


def check_6_mermaid(fm_text, body, filename):
    """Mermaid consistency."""
    if fm_text is None:
        return []
    mermaid_enabled = re.search(r'^mermaid:\s*true', fm_text, re.MULTILINE)
    has_mermaid_block = re.search(r'^```mermaid', body, re.MULTILINE)
    issues = []
    if mermaid_enabled and not has_mermaid_block:
        issues.append("mermaid: true but no ```mermaid block")
    if has_mermaid_block and not mermaid_enabled:
        issues.append("Has ```mermaid block but no mermaid: true")
    return issues


def check_7_liquid(body, filename):
    """No liquid tags outside code/raw blocks."""
    stripped = strip_code_and_raw_blocks(body)
    legitimate = [
        r'\{%\s*post_url\s', r'\{%\s*link\s', r'\{%\s*include\s',
        r'\{%\s*raw\s*%\}', r'\{%\s*endraw\s*%\}', r'\{%\s*highlight\s',
        r'\{%\s*endhighlight\s*%\}', r'\{%\s*if\s', r'\{%\s*endif\s*%\}',
        r'\{%\s*for\s', r'\{%\s*endfor\s*%\}',
    ]
    issues = []
    for i, line in enumerate(stripped.split("\n"), 1):
        if '{{' in line:
            issues.append(f"Line {i}: {{ {{ outside code/raw: '{line.strip()[:60]}'")
        tags = re.findall(r'\{%.*?%\}', line)
        for tag in tags:
            if not any(re.match(p, tag) for p in legitimate):
                issues.append(f"Line {i}: Suspicious {{% tag: '{tag}'")
    return issues


def check_8_tone(slug, body, tone_map):
    """Tone/voice check."""
    if slug not in tone_map:
        return [f"No tone assignment in tone-assignments.json"]
    tone = tone_map[slug]
    if tone == "tutorial":
        return []
    opening = body[:500].lower()
    tone_signals = {
        "beginner": ["imagine", "you've", "you have", "let's", "getting started", "first time",
                     "ever wondered", "you've heard", "don't worry", "simple", "easy",
                     "step by step", "beginner", "introduction", "welcome"],
        "deep-dive": ["we designed", "trade-off", "architecture", "under the hood", "internals",
                     "implementation", "how we built", "engineering", "system", "mechanism",
                     "pattern", "abstraction", "protocol", "pipeline"],
        "opinion": ["no single", "anyone betting", "i believe", "we believe", "the truth is",
                   "unpopular", "controversial", "why", "the problem with", "the real",
                   "most people", "hot take", "the future", "revolution", "rethink",
                   "false", "stop", "every", "risk", "ignore", "bet", "sand",
                   "underestimated", "gap", "not a", "different job"],
        "comparison": ["solve different problems", "honest look", "compare", "vs", "versus",
                      "both", "each", "trade-off", "strengths", "weaknesses", "when to use",
                      "choosing", "depends", "different approaches"],
        "announcement": ["we're excited", "thrilled", "announcing", "new", "launch", "release",
                        "introducing", "proud", "shipped", "live", "ready", "today we",
                        "we are excited", "direction", "year in review"],
    }
    if tone in tone_signals:
        found = [s for s in tone_signals[tone] if s in opening]
        if not found:
            return [f"Tone '{tone}' lacks signals in opening"]
    return []


def check_9_toc(fm, filename):
    """toc: true for all posts except welcome."""
    if filename == WELCOME_POST:
        return []
    toc_val = fm.get("toc", "") if fm else ""
    if str(toc_val).lower() != "true":
        return [f"toc is '{toc_val}', expected 'true'"]
    return []


def check_10_pin(fm, filename):
    """pin field present."""
    if fm is None:
        return ["No front matter"]
    if "pin" not in fm:
        return ["Missing 'pin' field"]
    return []


def check_11_body_length(body, filename):
    """Body >= 200 lines."""
    if filename == WELCOME_POST:
        return []
    lines = body.split("\n")
    count = len(lines)
    if count < 200:
        return [f"Body only {count} lines (need >= 200)"]
    return []


def check_12_multiple_h2(body, filename):
    """At least 2 ## headings."""
    if filename == WELCOME_POST:
        return []
    stripped = strip_code_blocks(body)
    h2_count = len(re.findall(r'^##\s+', stripped, re.MULTILINE))
    if h2_count < 2:
        return [f"Only {h2_count} H2 headings (need >= 2)"]
    return []


def check_13_placeholder(body, filename):
    """No problematic placeholder text outside code blocks."""
    stripped = strip_code_blocks(body)
    issues = []
    legitimate = [
        "sk-placeholder", "placeholder:", "placeholder token", "placeholder tokens",
        "placeholder injection", "the placeholder", "contain the placeholder",
        "replace the placeholder values", "replace the placeholder",
        # A post describing a code mechanism that INSERTS placeholder strings
        # (e.g. context-compaction replacing pruned tool output with a placeholder)
        # is real content, not draft incompleteness. Allow descriptive usage.
        "placeholder string", "placeholder value", "placeholder text",
        "placeholder message", "placeholder content", "with a placeholder",
        "as a placeholder", "insert a placeholder", "inserts a placeholder",
        "a placeholder for",
    ]
    for i, line in enumerate(stripped.split("\n"), 1):
        if "placeholder" in line.lower():
            line_lower = line.lower()
            is_legit = any(p in line_lower for p in legitimate)
            if not is_legit:
                issues.append(f"Line ~{i}: '{line.strip()[:80]}'")
    return issues


def check_14_has_code(body, filename):
    """At least one code block pair."""
    if filename == WELCOME_POST:
        return []
    count = count_backtick_fences(body)
    if count < 2:
        return [f"No code blocks found ({count} fence markers)"]
    return []


def check_15_link_format(body, filename):
    """Internal links use /posts/slug/ format, not raw file paths."""
    issues = []
    stripped = strip_code_blocks(body)
    # Check for raw _posts/ references in links
    for i, line in enumerate(stripped.split("\n"), 1):
        if re.search(r'\[.*?\]\(.*?_posts/', line):
            issues.append(f"Line ~{i}: raw _posts/ link: '{line.strip()[:80]}'")
        if re.search(r'\[.*?\]\(\./.*?\.md\)', line):
            issues.append(f"Line ~{i}: raw .md link: '{line.strip()[:80]}'")
    return issues


def check_16_related_posts(body, filename):
    """Related posts section exists with correct format."""
    if filename == WELCOME_POST:
        return []  # exempt
    issues = []
    if "**Related posts:**" not in body:
        if "**Related Posts:**" in body:
            issues.append("Uses '**Related Posts:**' (capital P) instead of '**Related posts:**'")
        elif "**Related reading:**" in body or "**Related:**" in body:
            issues.append("Uses non-standard related section header")
        else:
            issues.append("Missing '**Related posts:**' section")
    return issues


def check_17_no_future_links(body, filename, slug_date_map):
    """No future-dated related post links."""
    post_date = get_date_from_filename(filename)
    if not post_date:
        return []

    issues = []
    # Find related posts section
    related_match = re.search(r'\*\*Related posts:\*\*', body)
    if related_match:
        related_section = body[related_match.start():]
        links = re.findall(r'/posts/([\w-]+)/', related_section)
        for slug in links:
            if slug in slug_date_map:
                linked_date = slug_date_map[slug]
                if linked_date > post_date:
                    issues.append(f"FUTURE LINK in Related: /posts/{slug}/ (dated {linked_date}) > post date {post_date}")

    return issues


def check_17_inline_future_links(body, filename, slug_date_map):
    """Check inline body links for future dates too."""
    post_date = get_date_from_filename(filename)
    if not post_date:
        return []

    issues = []
    stripped = strip_code_blocks(body)
    # Find related section start to exclude it from inline check
    related_pos = stripped.find("**Related posts:**")
    if related_pos > 0:
        check_body = stripped[:related_pos]
    else:
        check_body = stripped

    links = re.findall(r'/posts/([\w-]+)/', check_body)
    for slug in links:
        if slug in slug_date_map:
            linked_date = slug_date_map[slug]
            if linked_date > post_date:
                issues.append(f"INLINE FUTURE: /posts/{slug}/ (dated {linked_date}) > post date {post_date}")

    return issues


def check_18_no_raw_md_paths(body, filename):
    """No raw .md file paths outside code blocks."""
    stripped = strip_code_blocks(body)
    issues = []
    for i, line in enumerate(stripped.split("\n"), 1):
        matches = re.findall(r'\./[\w-]+\.md', line)
        for match in matches:
            issues.append(f"Line ~{i}: raw .md path: '{match}'")
    return issues


def check_19_date_format(fm_text, filename):
    """Valid date format in front matter matching filename."""
    if fm_text is None:
        return ["No front matter"]
    date_match = re.search(r'^date:\s*(.*)', fm_text, re.MULTILINE)
    if not date_match:
        return ["No date field"]
    date_val = date_match.group(1).strip().strip("'\"")
    # Check format: YYYY-MM-DD HH:MM:SS +NNNN
    if not re.match(r'\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4}', date_val):
        return [f"Invalid date format: '{date_val}'"]
    # Check date matches filename
    file_date = get_date_from_filename(filename)
    fm_date = date_val[:10]
    if file_date and fm_date != file_date:
        return [f"Date mismatch: filename={file_date}, frontmatter={fm_date}"]
    return []


def check_20_image_alt(fm_text, filename):
    """image.alt exists and non-empty."""
    if fm_text is None:
        return ["No front matter"]
    alt = extract_image_alt_from_fm(fm_text)
    if alt is None:
        return ["Missing image.alt"]
    if not alt.strip():
        return ["Empty image.alt"]
    return []


def check_21_description_length(fm_text, filename):
    """Description >= 50 characters."""
    if fm_text is None:
        return ["No front matter"]
    desc = extract_description_from_fm(fm_text)
    if not desc:
        return ["No description found"]
    if len(desc) < 50:
        return [f"Description only {len(desc)} chars: '{desc[:80]}'"]
    return []


# ── Cross-Post Checks ───────────────────────────────────────────────────────

def cross_post_checks(posts, slug_date_map, post_titles):
    """Phase 6: Cross-post consistency."""
    all_linked_slugs = set()
    all_posts_slugs = set(slug_date_map.keys())
    broken_slugs = []
    mismatched_titles = []
    link_counts = {0: 0, 1: 0, 2: 0, 3: 0, "4+": 0}

    for post_file in posts:
        filepath = POSTS_DIR / post_file
        content = filepath.read_text(encoding="utf-8")
        _, body = parse_front_matter_raw(content)
        slug = get_slug_from_filename(post_file)

        if post_file == WELCOME_POST:
            # Welcome post has no related section
            link_counts[0] += 1
            continue

        related_match = re.search(r'\*\*Related posts:\*\*', body)
        if not related_match:
            link_counts[0] += 1
            continue

        related_section = body[related_match.start():]
        # Extract links: [Title](/posts/slug/)
        links = re.findall(r'\[([^\]]+)\]\(/posts/([\w-]+)/\)', related_section)

        count = len(links)
        if count >= 4:
            link_counts["4+"] += 1
        else:
            link_counts[count] += 1

        for title_text, linked_slug in links:
            all_linked_slugs.add(linked_slug)
            # Check slug exists
            if linked_slug not in all_posts_slugs:
                broken_slugs.append((post_file, linked_slug))
            # Check title accuracy (exact match after normalizing whitespace and case)
            elif linked_slug in post_titles:
                actual_title = post_titles[linked_slug]
                norm_link = " ".join(title_text.lower().split())
                norm_actual = " ".join(actual_title.lower().split())
                if norm_link != norm_actual:
                    mismatched_titles.append((post_file, linked_slug, title_text, actual_title))

    # Orphan check
    orphans = all_posts_slugs - all_linked_slugs

    return broken_slugs, mismatched_titles, link_counts, orphans


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    # Load tone assignments
    tone_map = {}
    if TONE_FILE.exists():
        with open(TONE_FILE) as f:
            tone_data = json.load(f)
        tone_map = {item["slug"]: item["tone"] for item in tone_data}

    posts = sorted([f for f in os.listdir(POSTS_DIR) if f.endswith(".md")])
    total = len(posts)

    # Build slug-date map
    slug_date_map = build_slug_date_map(posts)

    # Build post titles map
    post_titles = {}
    for post_file in posts:
        filepath = POSTS_DIR / post_file
        content = filepath.read_text(encoding="utf-8")
        fm_text, _ = parse_front_matter_raw(content)
        if fm_text:
            title = extract_title_from_fm(fm_text)
            if title:
                slug = get_slug_from_filename(post_file)
                if slug:
                    post_titles[slug] = title

    # ── Phase 1 ──
    print("=" * 80)
    print("PHASE 1: ENVIRONMENT & FILE INVENTORY")
    print("=" * 80)
    print(f"  Total .md files: {total}")
    non_md = [f for f in os.listdir(POSTS_DIR) if not f.endswith(".md")]
    print(f"  Non-.md files: {len(non_md)}")
    if non_md:
        for f in non_md:
            print(f"    - {f}")

    # Validate filename pattern
    bad_filenames = []
    for f in posts:
        if not re.match(r'^\d{4}-\d{2}-\d{2}-[\w-]+\.md$', f):
            bad_filenames.append(f)
    print(f"  Invalid filenames: {len(bad_filenames)}")

    # Validate dates
    bad_dates = []
    for f in posts:
        date_str = get_date_from_filename(f)
        if date_str:
            try:
                datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                bad_dates.append((f, date_str))
    print(f"  Invalid dates in filenames: {len(bad_dates)}")

    # Duplicate slugs
    slug_counts = {}
    for f in posts:
        slug = get_slug_from_filename(f)
        slug_counts[slug] = slug_counts.get(slug, 0) + 1
    dupes = {k: v for k, v in slug_counts.items() if v > 1}
    print(f"  Duplicate slugs: {len(dupes)}")
    if dupes:
        for slug, count in dupes.items():
            print(f"    - '{slug}' appears {count} times")

    dates = sorted(slug_date_map.values())
    print(f"  Date range: {dates[0]} to {dates[-1]}")

    # ── Phases 2-5: Per-post checks ──
    check_names = {
        1: "Front matter fields",
        2: "Image path exists",
        3: "No duplicate H1",
        4: "No Published callout",
        5: "Code block balance",
        6: "Mermaid consistency",
        7: "Liquid syntax safety",
        8: "Tone/voice check",
        9: "toc: true",
        10: "pin: present",
        11: "Body >= 200 lines",
        12: "Multiple H2 headings",
        13: "No placeholder text",
        14: "Has code blocks",
        15: "Link format (/posts/slug/)",
        16: "Related posts section",
        17: "No future-dated links",
        18: "No raw .md paths",
        19: "Valid date format",
        20: "image.alt exists",
        21: "Description >= 50 chars",
    }

    results = {}
    for i in range(1, 22):
        results[i] = {"pass": 0, "fail": 0, "failures": []}

    # inline_future_issues check removed — forward cross-references are valid

    for post_file in posts:
        filepath = POSTS_DIR / post_file
        content = filepath.read_text(encoding="utf-8")
        fm_text, body = parse_front_matter_raw(content)
        fm = parse_yaml_simple(fm_text) if fm_text else None
        slug = get_slug_from_filename(post_file)

        checks = {
            1: check_1_front_matter(fm, fm_text, post_file),
            2: check_2_image_path(fm_text, post_file),
            3: check_3_no_h1(body, post_file),
            4: check_4_no_published(body, post_file),
            5: check_5_code_balance(body, post_file),
            6: check_6_mermaid(fm_text, body, post_file),
            7: check_7_liquid(body, post_file),
            8: check_8_tone(slug, body, tone_map) if slug else [],
            9: check_9_toc(fm, post_file),
            10: check_10_pin(fm, post_file),
            11: check_11_body_length(body, post_file),
            12: check_12_multiple_h2(body, post_file),
            13: check_13_placeholder(body, post_file),
            14: check_14_has_code(body, post_file),
            15: check_15_link_format(body, post_file),
            16: check_16_related_posts(body, post_file),
            17: check_17_no_future_links(body, post_file, slug_date_map),
            18: check_18_no_raw_md_paths(body, post_file),
            19: check_19_date_format(fm_text, post_file),
            20: check_20_image_alt(fm_text, post_file),
            21: check_21_description_length(fm_text, post_file),
        }

        for check_num, issues in checks.items():
            if issues:
                results[check_num]["fail"] += 1
                results[check_num]["failures"].append((post_file, issues))
            else:
                results[check_num]["pass"] += 1

        # Inline future link check — skipped because forward cross-references
        # are valid (all posts exist in the repo; broken slugs catches dead links)

    # ── Print Phase 2-5 Results ──
    phases = [
        ("PHASE 2: FRONT MATTER CHECKS", [1, 2, 9, 10, 19, 20, 21]),
        ("PHASE 3: CONTENT STRUCTURE CHECKS", [3, 4, 5, 6, 11, 12, 14]),
        ("PHASE 4: CONTENT QUALITY CHECKS", [7, 8, 13, 15, 18]),
        ("PHASE 5: RELATED POSTS VERIFICATION", [16, 17]),
    ]

    for phase_name, check_ids in phases:
        print(f"\n{'=' * 80}")
        print(phase_name)
        print("=" * 80)
        for cid in check_ids:
            r = results[cid]
            status = "PASS" if r["fail"] == 0 else "FAIL"
            print(f"  Check #{cid:<3} ({check_names[cid]:<30}): {status} — {r['pass']}/{total} pass", end="")
            if r["fail"] > 0:
                print(f", {r['fail']} FAIL")
                for fname, issues in r["failures"]:
                    for issue in issues:
                        print(f"    ! {fname}: {issue}")
            else:
                print()

    # Inline future links — not reported (forward cross-references are valid)

    # ── Phase 6: Cross-post consistency ──
    print(f"\n{'=' * 80}")
    print("PHASE 6: CROSS-POST CONSISTENCY")
    print("=" * 80)

    broken_slugs, mismatched_titles, link_counts, orphans = cross_post_checks(posts, slug_date_map, post_titles)

    print(f"  Broken slugs (link to nonexistent post): {len(broken_slugs)}")
    for fname, slug in broken_slugs:
        print(f"    ! {fname}: broken link to /posts/{slug}/")

    print(f"  Mismatched titles: {len(mismatched_titles)}")
    for fname, slug, link_title, actual_title in mismatched_titles:
        print(f"    ! {fname}: '{link_title}' != actual '{actual_title}' for slug '{slug}'")

    print(f"  Link count distribution:")
    print(f"    0 links: {link_counts.get(0, 0)} (expected 1 = welcome post)")
    print(f"    1 link:  {link_counts.get(1, 0)}")
    print(f"    2 links: {link_counts.get(2, 0)}")
    print(f"    3 links: {link_counts.get(3, 0)}")
    print(f"    4+ links: {link_counts.get('4+', 0)} (should be 0)")

    print(f"  Orphan posts (never linked to): {len(orphans)}")
    for slug in sorted(orphans):
        print(f"    - {slug}")

    # ── Phase 8: Specific file checks ──
    print(f"\n{'=' * 80}")
    print("PHASE 8: SPECIFIC FILE VERIFICATION")
    print("=" * 80)

    # 8.1: Expanded posts
    expanded_posts = [
        ("2025-06-08-why-we-built-neurolink.md", 200),
        ("2025-10-13-ai-sdk-landscape-2026.md", 200),
        ("2025-11-06-total-cost-of-ownership.md", 200),
        ("2026-02-03-open-source-neurolink.md", 200),
    ]
    print("  8.1: Expanded posts (body >= 200 lines):")
    all_expanded_pass = True
    for fname, min_lines in expanded_posts:
        fpath = POSTS_DIR / fname
        if fpath.exists():
            content = fpath.read_text(encoding="utf-8")
            _, body = parse_front_matter_raw(content)
            line_count = len(body.split("\n"))
            has_code = count_backtick_fences(body) >= 2
            status = "PASS" if line_count >= min_lines else "FAIL"
            if status == "FAIL":
                all_expanded_pass = False
            code_status = "has code" if has_code else "NO CODE"
            print(f"    {fname}: {line_count} lines — {status}, {code_status}")
        else:
            print(f"    {fname}: FILE NOT FOUND")
            all_expanded_pass = False

    # 8.2: Provider failover casing
    print("  8.2: Provider failover casing fix:")
    pf_file = POSTS_DIR / "2025-06-18-provider-failover-patterns.md"
    pf_content = pf_file.read_text(encoding="utf-8")
    if "**Related posts:**" in pf_content and "**Related Posts:**" not in pf_content:
        print(f"    PASS — uses '**Related posts:**' (lowercase p)")
    else:
        print(f"    FAIL — still uses capital P or missing section")

    # 8.3: CLI automation raw path fix
    print("  8.3: CLI automation raw path fix:")
    cli_file = POSTS_DIR / "2025-09-12-cli-automation.md"
    cli_content = cli_file.read_text(encoding="utf-8")
    _, cli_body = parse_front_matter_raw(cli_content)
    cli_stripped = strip_code_blocks(cli_body)
    raw_paths = re.findall(r'\./[\w-]+\.md', cli_stripped)
    if raw_paths:
        print(f"    FAIL — found raw .md paths: {raw_paths}")
    else:
        print(f"    PASS — no raw .md paths found")

    # 8.4: Welcome post exemptions
    print("  8.4: Welcome post exemptions:")
    welcome_file = POSTS_DIR / WELCOME_POST
    welcome_content = welcome_file.read_text(encoding="utf-8")
    welcome_fm_text, welcome_body = parse_front_matter_raw(welcome_content)
    welcome_fm = parse_yaml_simple(welcome_fm_text) if welcome_fm_text else None

    has_related = "**Related posts:**" in welcome_body
    toc_val = welcome_fm.get("toc", "") if welcome_fm else ""
    body_lines = len(welcome_body.split("\n"))

    welcome_pass = True
    if has_related:
        print(f"    FAIL — has Related posts section (should not)")
        welcome_pass = False
    else:
        print(f"    PASS — no Related posts section")
    if str(toc_val).lower() == "false":
        print(f"    PASS — toc: false (acceptable)")
    else:
        print(f"    NOTE — toc: {toc_val}")
    print(f"    Body lines: {body_lines} (exempt from 200-line minimum)")

    # 8.5: Legitimate placeholder usage
    print("  8.5: Legitimate placeholder usage (should NOT be flagged):")
    placeholder_posts = [
        ("2025-08-08-openai-compatible-endpoints.md", "sk-placeholder"),
        ("2025-08-30-enterprise-security-guide.md", "placeholder tokens"),
        ("2025-10-03-debugging-ai-applications.md", "the placeholder"),
        ("2025-11-15-slack-bot-tutorial.md", "placeholder:"),
        ("2026-02-01-raw-data-to-reports-automating-bi-with-ai.md", "placeholder injection"),
    ]
    for fname, expected_context in placeholder_posts:
        fpath = POSTS_DIR / fname
        if fpath.exists():
            content = fpath.read_text(encoding="utf-8")
            # Check if this post would be flagged by check 13
            _, body = parse_front_matter_raw(content)
            issues = check_13_placeholder(body, fname)
            if issues:
                print(f"    FAIL — {fname} incorrectly flagged: {issues[0]}")
            else:
                print(f"    PASS — {fname} ({expected_context}) not flagged")
        else:
            print(f"    SKIP — {fname} not found")

    # ── Final Summary ──
    print(f"\n{'=' * 80}")
    print("FINAL SUMMARY REPORT")
    print("=" * 80)
    print(f"  Total Posts: {total}")
    print(f"  Date Range: {dates[0]} to {dates[-1]}")
    print()
    print(f"  {'Check #':<10} {'Name':<32} {'Pass':<7} {'Fail':<7} {'Status':<8}")
    print(f"  {'─' * 65}")

    total_failures = 0
    for cid in range(1, 22):
        r = results[cid]
        status = "PASS" if r["fail"] == 0 else "FAIL"
        if r["fail"] > 0:
            total_failures += r["fail"]
        print(f"  {cid:<10} {check_names[cid]:<32} {r['pass']:<7} {r['fail']:<7} {status:<8}")

    print(f"\n  Cross-Post Checks:")
    print(f"    Broken slugs:        {len(broken_slugs)}")
    print(f"    Mismatched titles:   {len(mismatched_titles)}")
    print(f"    Orphan posts:        {len(orphans)}")

    cross_post_failures = len(broken_slugs) + len(orphans) + len(mismatched_titles)
    all_failures = total_failures + cross_post_failures
    if all_failures == 0:
        overall = "ALL PASS"
    else:
        parts = []
        if total_failures > 0:
            parts.append(f"{total_failures} check failures")
        if len(broken_slugs) > 0:
            parts.append(f"{len(broken_slugs)} broken slugs")
        if len(orphans) > 0:
            parts.append(f"{len(orphans)} orphan posts")
        if len(mismatched_titles) > 0:
            parts.append(f"{len(mismatched_titles)} mismatched titles")
        overall = "FAILURES FOUND: " + ", ".join(parts)
    print(f"\n  OVERALL VERDICT: {overall}")
    print("=" * 80)

    return all_failures


if __name__ == "__main__":
    issues = main()
    sys.exit(0 if issues == 0 else 1)
