#!/usr/bin/env python3
"""Fix content issues across all 135 blog posts."""
import os
import re
import json

POSTS_DIR = '_posts'
GIF_SPECS_FILE = 'tools/blog-visuals/src/data/gif-specs.json'

# Load GIF specs - each entry has slug and gifs array
with open(GIF_SPECS_FILE) as f:
    gif_specs = json.load(f)

# Group GIFs by slug, extract name for filename
gif_map = {}
for entry in gif_specs:
    slug = entry['slug']
    if slug not in gif_map:
        gif_map[slug] = []
    for gif in entry.get('gifs', []):
        gif_map[slug].append({
            'name': gif['name'],
            'title': gif.get('title', gif.get('concept', gif['name'])),
            'type': gif['type'],
            'filename': gif['name'] + '.gif',
        })

fixed_h1 = 0
fixed_published = 0
fixed_gifs = 0
files_modified = 0

for filename in sorted(os.listdir(POSTS_DIR)):
    if not filename.endswith('.md'):
        continue

    filepath = os.path.join(POSTS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Split into front matter and body
    match = re.match(r'^(---\n.*?\n---\n)(.*)', content, re.DOTALL)
    if not match:
        continue

    front_matter = match.group(1)
    body = match.group(2)
    original_body = body

    # === Fix 1: Remove duplicate H1 title ===
    new_body = re.sub(r'^(\s*\n)*# [^\n]+\n', '\n', body, count=1)
    if new_body != body:
        fixed_h1 += 1
        body = new_body

    # === Fix 2: Remove Published callout ===
    prev = body
    body = re.sub(
        r'\n*> \*\*Published:\*\*[^\n]*\n\{: \.prompt-info \}\s*\n*',
        '\n',
        body
    )
    if body != prev:
        fixed_published += 1

    # === Clean up excessive blank lines ===
    body = re.sub(r'\n{4,}', '\n\n\n', body)
    body = '\n' + body.lstrip('\n')

    # === Fix 3: Embed GIFs ===
    slug = re.sub(r'^\d{4}-\d{2}-\d{2}-', '', filename.replace('.md', ''))

    if slug in gif_map:
        gifs_to_insert = []
        for gif in gif_map[slug]:
            gif_path = '/assets/img/posts/{}/{}'.format(slug, gif['filename'])
            if gif_path not in body:
                gifs_to_insert.append(gif)

        if gifs_to_insert:
            sections = list(re.finditer(r'^## .+$', body, re.MULTILINE))

            for idx, gif in enumerate(gifs_to_insert):
                gif_path = '/assets/img/posts/{}/{}'.format(slug, gif['filename'])
                gif_md = '\n![{}]({})\n'.format(gif['title'], gif_path)

                section_idx = min(idx + 1, len(sections) - 1) if sections else -1

                if section_idx >= 0 and section_idx < len(sections):
                    insert_pos = sections[section_idx].start()
                    body = body[:insert_pos] + gif_md + '\n' + body[insert_pos:]
                    sections = list(re.finditer(r'^## .+$', body, re.MULTILINE))
                    fixed_gifs += 1
                elif len(body.strip()) > 100:
                    body = body.rstrip() + '\n' + gif_md + '\n'
                    fixed_gifs += 1

    if body != original_body:
        files_modified += 1
        new_content = front_matter + body
        with open(filepath, 'w') as f:
            f.write(new_content)

print('Fixed H1 duplicates: {}'.format(fixed_h1))
print('Fixed Published lines: {}'.format(fixed_published))
print('Embedded GIFs: {}'.format(fixed_gifs))
print('Files modified: {}'.format(files_modified))
