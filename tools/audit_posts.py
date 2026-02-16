#!/usr/bin/env python3
"""Comprehensive blog post auditor for NeuroLink Blog."""

import os
import re
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT_DIR / "_posts"
TONE_FILE = ROOT_DIR / "tools" / "blog-visuals" / "src" / "data" / "tone-assignments.json"

REQUIRED_FRONT_MATTER = ["layout", "title", "date", "categories", "tags", "author", "description", "toc"]

# ── Helpers ──────────────────────────────────────────────────────────────────

def parse_front_matter_raw(content):
    """Extract raw front matter text and body from content."""
    if not content.startswith("---"):
        return None, content
    end = content.find("---", 3)
    if end == -1:
        return None, content
    fm_text = content[3:end].strip()
    body = content[end + 3:].strip()
    return fm_text, body


def parse_yaml_simple(fm_text):
    """Simple YAML parser that handles nested keys like image.path."""
    fm = {}
    current_key = None
    current_list = None
    indent_stack = [("root", fm)]

    for line in fm_text.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Calculate indent level
        indent = len(line) - len(line.lstrip())

        # List item under a key
        if stripped.startswith("- ") and current_key:
            if current_list is None:
                current_list = []
                fm[current_key] = current_list
            current_list.append(stripped[2:].strip())
            continue

        # Key: value at any indent
        if ":" in stripped:
            current_list = None
            parts = stripped.split(":", 1)
            key = parts[0].strip()
            val = parts[1].strip().strip("'\"").strip()

            # Remove YAML multiline indicators
            if val in (">-", ">", "|", "|-"):
                val = ""

            current_key = key
            fm[key] = val

    return fm


def strip_code_blocks(body):
    """Remove fenced code blocks from body, return stripped body."""
    pattern = re.compile(r'^```[^\n]*\n.*?^```', re.MULTILINE | re.DOTALL)
    stripped = pattern.sub('', body)
    return stripped


def strip_code_and_raw_blocks(body):
    """Remove fenced code blocks and {% raw %}...{% endraw %} blocks."""
    raw_pattern = re.compile(r'\{%\s*raw\s*%\}.*?\{%\s*endraw\s*%\}', re.DOTALL)
    stripped = raw_pattern.sub('', body)
    code_pattern = re.compile(r'^```[^\n]*\n.*?^```', re.MULTILINE | re.DOTALL)
    stripped = code_pattern.sub('', stripped)
    stripped = re.sub(r'`[^`]+`', '', stripped)
    return stripped


def count_backtick_fences(body):
    """Count the number of ``` fence markers in body."""
    return len(re.findall(r'^```', body, re.MULTILINE))


def get_slug_from_filename(filename):
    """Extract slug from post filename: YYYY-MM-DD-slug.md -> slug."""
    m = re.match(r'\d{4}-\d{2}-\d{2}-(.*?)\.md$', filename)
    return m.group(1) if m else None


def extract_image_path_from_fm(fm_text):
    """Extract image.path from front matter text, handling YAML multiline."""
    lines = fm_text.split("\n")
    in_image = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Start of image section
        if re.match(r'^image:\s*$', stripped):
            in_image = True
            continue
        if in_image:
            # Check for path key
            path_match = re.match(r'^\s+path:\s*(.*)', line)
            if path_match:
                val = path_match.group(1).strip().strip("'\"")
                # Handle YAML multiline >-
                if val in (">-", ">", "|", "|-", ""):
                    # Next line has the actual path
                    if i + 1 < len(lines):
                        val = lines[i + 1].strip().strip("'\"")
                return val
            # If we hit another top-level key, stop
            if not line.startswith(" ") and not line.startswith("\t"):
                break
    return None


# ── Checks ───────────────────────────────────────────────────────────────────

def check_front_matter(fm, filename):
    """Check 1: Front matter has all required fields."""
    issues = []
    if fm is None:
        return ["No front matter found"]
    for field in REQUIRED_FRONT_MATTER:
        if field not in fm:
            issues.append(f"Missing field: {field}")
    return issues


def check_image_path(fm_text, filename):
    """Check 2: image.path exists in front matter and points to a real file."""
    issues = []
    if fm_text is None:
        return ["No front matter"]

    img_path = extract_image_path_from_fm(fm_text)
    if img_path is None:
        return ["Missing image section or image.path in front matter"]
    if not img_path:
        return ["Empty image.path"]

    # Check if the file exists on disk
    full_path = ROOT_DIR / img_path.lstrip("/")
    if not full_path.exists():
        issues.append(f"Image file not found on disk: {img_path}")

    return issues


def check_no_duplicate_h1(body, filename):
    """Check 3: No H1 headers (# Title) in body content outside code blocks."""
    stripped = strip_code_blocks(body)
    issues = []
    for i, line in enumerate(stripped.split("\n"), 1):
        if re.match(r'^#\s+[^#]', line):
            issues.append(f"Duplicate H1 found: '{line.strip()[:80]}'")
    return issues


def check_no_published_callout(body, filename):
    """Check 4: No '> **Published:**' lines followed by '{: .prompt-info }'."""
    issues = []
    lines = body.split("\n")
    for i, line in enumerate(lines):
        # Specifically check for Published callout pattern
        if re.search(r'>\s*\*\*Published', line):
            issues.append(f"Found Published callout at line {i+1}: '{line.strip()[:80]}'")
    return issues


def check_code_block_balance(body, filename):
    """Check 5: Even number of ``` markers (properly opened/closed)."""
    count = count_backtick_fences(body)
    issues = []
    if count % 2 != 0:
        issues.append(f"Unbalanced code fences: {count} markers (odd)")
    return issues


def check_mermaid(fm_text, body, filename):
    """Check 6: Posts with mermaid: true have at least one ```mermaid block."""
    issues = []
    if fm_text is None:
        return []

    mermaid_enabled = re.search(r'^mermaid:\s*true', fm_text, re.MULTILINE)
    has_mermaid_block = re.search(r'^```mermaid', body, re.MULTILINE)

    if mermaid_enabled and not has_mermaid_block:
        issues.append("mermaid: true but no ```mermaid block found in body")

    if has_mermaid_block and not mermaid_enabled:
        issues.append("Has ```mermaid block but mermaid: true not set in front matter")

    return issues


def check_liquid_syntax(body, filename):
    """Check 7: No {{ or {% outside code blocks and raw blocks (except legitimate Jekyll tags)."""
    stripped = strip_code_and_raw_blocks(body)
    issues = []

    legitimate_patterns = [
        r'\{%\s*post_url\s',
        r'\{%\s*link\s',
        r'\{%\s*include\s',
        r'\{%\s*raw\s*%\}',
        r'\{%\s*endraw\s*%\}',
        r'\{%\s*highlight\s',
        r'\{%\s*endhighlight\s*%\}',
        r'\{%\s*if\s',
        r'\{%\s*endif\s*%\}',
        r'\{%\s*for\s',
        r'\{%\s*endfor\s*%\}',
    ]

    for i, line in enumerate(stripped.split("\n"), 1):
        # Check for {{ }} (Liquid output tags)
        if '{{' in line:
            issues.append(f"Line {i}: Liquid output tag outside code/raw block: '{line.strip()[:80]}'")

        # Check for {% %} (Liquid logic tags)
        liquid_tags = re.findall(r'\{%.*?%\}', line)
        for tag in liquid_tags:
            is_legitimate = any(re.match(pat, tag) for pat in legitimate_patterns)
            if not is_legitimate:
                issues.append(f"Line {i}: Suspicious Liquid tag outside code/raw block: '{tag}'")

    return issues


def check_tone(slug, body, tone_map):
    """Check 8: Tone/voice check for non-tutorial posts."""
    issues = []
    if slug not in tone_map:
        issues.append(f"No tone assignment found in tone-assignments.json")
        return issues

    tone = tone_map[slug]
    if tone == "tutorial":
        return []  # Skip tutorials

    # Get the first 500 chars of body as "opening"
    opening = body[:500].lower()

    tone_signals = {
        "beginner": {
            "expected": ["imagine", "you've", "you have", "let's", "getting started", "first time",
                        "ever wondered", "you've heard", "don't worry", "simple", "easy",
                        "step by step", "beginner", "introduction", "welcome"],
            "description": "friendly/welcoming language"
        },
        "deep-dive": {
            "expected": ["we designed", "trade-off", "architecture", "under the hood", "internals",
                        "implementation", "how we built", "engineering", "system", "mechanism",
                        "pattern", "abstraction", "protocol", "pipeline"],
            "description": "dense/systems language"
        },
        "opinion": {
            "expected": ["no single", "anyone betting", "i believe", "we believe", "the truth is",
                        "unpopular", "controversial", "why", "the problem with", "the real",
                        "most people", "hot take", "the future", "revolution", "rethink",
                        "false", "stop", "every", "risk", "ignore", "bet", "sand",
                        "underestimated", "gap", "not a", "different job"],
            "description": "strong position language"
        },
        "comparison": {
            "expected": ["solve different problems", "honest look", "compare", "vs", "versus",
                        "both", "each", "trade-off", "strengths", "weaknesses", "when to use",
                        "choosing", "depends", "different approaches"],
            "description": "balanced/evaluative language"
        },
        "announcement": {
            "expected": ["we're excited", "thrilled", "announcing", "new", "launch", "release",
                        "introducing", "proud", "shipped", "live", "ready", "today we",
                        "we are excited", "direction", "year in review"],
            "description": "concise/celebrating language"
        }
    }

    if tone in tone_signals:
        signals = tone_signals[tone]
        found = [s for s in signals["expected"] if s in opening]
        if not found:
            issues.append(
                f"Tone '{tone}' assigned but opening lacks {signals['description']}. "
                f"Expected keywords like: {', '.join(signals['expected'][:5])}. "
                f"Opening: '{body[:120].strip()}...'"
            )

    return issues


# ── Main Audit ───────────────────────────────────────────────────────────────

def main():
    # Load tone assignments
    with open(TONE_FILE) as f:
        tone_data = json.load(f)
    tone_map = {item["slug"]: item["tone"] for item in tone_data}

    # Get all posts
    posts = sorted([f for f in os.listdir(POSTS_DIR) if f.endswith(".md")])
    total = len(posts)

    print(f"=" * 80)
    print(f"NEUROLINK BLOG AUDIT REPORT")
    print(f"Total posts: {total}")
    print(f"=" * 80)

    # Results tracking
    results = {
        "front_matter": {"pass": 0, "fail": 0, "failures": []},
        "image_path": {"pass": 0, "fail": 0, "failures": []},
        "no_duplicate_h1": {"pass": 0, "fail": 0, "failures": []},
        "no_published_callout": {"pass": 0, "fail": 0, "failures": []},
        "code_block_balance": {"pass": 0, "fail": 0, "failures": []},
        "mermaid": {"pass": 0, "fail": 0, "failures": []},
        "liquid_syntax": {"pass": 0, "fail": 0, "failures": []},
        "tone_voice": {"pass": 0, "fail": 0, "failures": [], "skipped": 0},
    }

    for post_file in posts:
        filepath = POSTS_DIR / post_file
        content = filepath.read_text(encoding="utf-8")
        fm_text, body = parse_front_matter_raw(content)
        fm = parse_yaml_simple(fm_text) if fm_text else None
        slug = get_slug_from_filename(post_file)

        # Check 1: Front matter validity
        issues = check_front_matter(fm, post_file)
        if issues:
            results["front_matter"]["fail"] += 1
            results["front_matter"]["failures"].append((post_file, issues))
        else:
            results["front_matter"]["pass"] += 1

        # Check 2: image.path exists and points to real file
        issues = check_image_path(fm_text, post_file)
        if issues:
            results["image_path"]["fail"] += 1
            results["image_path"]["failures"].append((post_file, issues))
        else:
            results["image_path"]["pass"] += 1

        # Check 3: No duplicate H1
        issues = check_no_duplicate_h1(body, post_file)
        if issues:
            results["no_duplicate_h1"]["fail"] += 1
            results["no_duplicate_h1"]["failures"].append((post_file, issues))
        else:
            results["no_duplicate_h1"]["pass"] += 1

        # Check 4: No Published callout
        issues = check_no_published_callout(body, post_file)
        if issues:
            results["no_published_callout"]["fail"] += 1
            results["no_published_callout"]["failures"].append((post_file, issues))
        else:
            results["no_published_callout"]["pass"] += 1

        # Check 5: Code block balance
        issues = check_code_block_balance(body, post_file)
        if issues:
            results["code_block_balance"]["fail"] += 1
            results["code_block_balance"]["failures"].append((post_file, issues))
        else:
            results["code_block_balance"]["pass"] += 1

        # Check 6: Mermaid validity
        issues = check_mermaid(fm_text, body, post_file)
        if issues:
            results["mermaid"]["fail"] += 1
            results["mermaid"]["failures"].append((post_file, issues))
        else:
            results["mermaid"]["pass"] += 1

        # Check 7: Liquid syntax
        issues = check_liquid_syntax(body, post_file)
        if issues:
            results["liquid_syntax"]["fail"] += 1
            results["liquid_syntax"]["failures"].append((post_file, issues))
        else:
            results["liquid_syntax"]["pass"] += 1

        # Check 8: Tone voice
        if slug:
            tone = tone_map.get(slug, None)
            if tone == "tutorial":
                results["tone_voice"]["skipped"] += 1
                results["tone_voice"]["pass"] += 1
            else:
                issues = check_tone(slug, body, tone_map)
                if issues:
                    results["tone_voice"]["fail"] += 1
                    results["tone_voice"]["failures"].append((post_file, issues))
                else:
                    results["tone_voice"]["pass"] += 1

    # ── Print Results ────────────────────────────────────────────────────────

    checks = [
        ("1. FRONT MATTER VALIDITY", "front_matter"),
        ("2. IMAGE PATH EXISTS", "image_path"),
        ("3. NO DUPLICATE H1", "no_duplicate_h1"),
        ("4. NO PUBLISHED CALLOUT", "no_published_callout"),
        ("5. CODE BLOCK BALANCE", "code_block_balance"),
        ("6. MERMAID VALIDITY", "mermaid"),
        ("7. LIQUID SYNTAX", "liquid_syntax"),
        ("8. TONE/VOICE CHECK", "tone_voice"),
    ]

    total_issues = 0

    for label, key in checks:
        r = results[key]
        status = "PASS" if r["fail"] == 0 else "FAIL"
        total_issues += r["fail"]

        print(f"\n{'─' * 80}")
        print(f"CHECK {label}")
        print(f"  Status: {status} | Checked: {r['pass'] + r['fail']} | Pass: {r['pass']} | Fail: {r['fail']}", end="")
        if "skipped" in r and r["skipped"] > 0:
            print(f" | Skipped (tutorials): {r['skipped']}", end="")
        print()

        if r["failures"]:
            print(f"  Failures:")
            for filename, issues in r["failures"]:
                for issue in issues:
                    print(f"    - {filename}: {issue}")

    print(f"\n{'=' * 80}")
    print(f"SUMMARY")
    print(f"  Total posts audited: {total}")
    print(f"  Total checks: 8")
    print(f"  Total failing posts (across all checks): {total_issues}")

    # Per-check summary table
    print(f"\n  {'Check':<35} {'Status':<8} {'Pass':<6} {'Fail':<6}")
    print(f"  {'─' * 55}")
    for label, key in checks:
        r = results[key]
        status = "PASS" if r["fail"] == 0 else "FAIL"
        short_label = label.split(". ", 1)[1] if ". " in label else label
        print(f"  {short_label:<35} {status:<8} {r['pass']:<6} {r['fail']:<6}")

    print(f"{'=' * 80}")

    return total_issues


if __name__ == "__main__":
    issues = main()
    sys.exit(0 if issues == 0 else 1)
