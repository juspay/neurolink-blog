#!/bin/bash
# Validate Mermaid diagrams in markdown files

set -e

POSTS_DIR="_posts"
ERROR_COUNT=0

echo "Validating Mermaid diagrams in ${POSTS_DIR}..."

# Find all markdown files with mermaid blocks
while IFS= read -r file; do
    if [ ! -f "$file" ]; then
        continue
    fi

    # Extract mermaid blocks and check syntax
    in_mermaid=false
    line_num=0
    block_start=0
    block_content=""

    while IFS= read -r line; do
        ((line_num++)) || true

        # Check for mermaid block start
        if [[ "$line" =~ ^[[:space:]]*\`\`\`mermaid[[:space:]]*$ ]]; then
            in_mermaid=true
            block_start=$line_num
            block_content=""
            continue
        fi

        # Check for mermaid block end
        if [[ "$line" =~ ^[[:space:]]*\`\`\`[[:space:]]*$ ]] && [ "$in_mermaid" = true ]; then
            in_mermaid=false

            # Validate the collected block content
            if [ -n "$block_content" ]; then
                # Check for unquoted parentheses in node labels (excluding database cylinder syntax)
                if echo "$block_content" | grep -qE '\[[^]]*\([^)]*\)[^]]*\]' && ! echo "$block_content" | grep -qE '\["[^"]*\([^)]*\)[^"]*"\]' && ! echo "$block_content" | grep -qE '\[\("[^"]*"\)\]'; then
                    echo "ERROR: ${file}:${block_start} - Unquoted parentheses in node label (should use quotes)"
                    ((ERROR_COUNT++)) || true
                fi

                # Check for unclosed brackets
                open_brackets=$(echo "$block_content" | tr -cd '[' | wc -c)
                close_brackets=$(echo "$block_content" | tr -cd ']' | wc -c)
                if [ "$open_brackets" -ne "$close_brackets" ]; then
                    echo "ERROR: ${file}:${block_start} - Mismatched square brackets"
                    ((ERROR_COUNT++)) || true
                fi

                # Check for unclosed braces
                open_braces=$(echo "$block_content" | tr -cd '{' | wc -c)
                close_braces=$(echo "$block_content" | tr -cd '}' | wc -c)
                if [ "$open_braces" -ne "$close_braces" ]; then
                    echo "ERROR: ${file}:${block_start} - Mismatched curly braces"
                    ((ERROR_COUNT++)) || true
                fi

                # Check for valid diagram type
                first_line=$(echo "$block_content" | head -n1 | xargs)
                valid_types="graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|C4Context|mindmap|timeline|quadrantChart"
                if ! echo "$first_line" | grep -qE "^($valid_types)"; then
                    echo "WARNING: ${file}:${block_start} - Potentially invalid diagram type: $first_line"
                fi
            fi

            block_content=""
            continue
        fi

        # Collect mermaid block content
        if [ "$in_mermaid" = true ]; then
            block_content="${block_content}${line}"$'\n'
        fi
    done < "$file"

    # Check for unclosed mermaid block
    if [ "$in_mermaid" = true ]; then
        echo "ERROR: ${file}:${block_start} - Unclosed mermaid block"
        ((ERROR_COUNT++))
    fi

done < <(find "$POSTS_DIR" -type f -name "*.md" 2>/dev/null || true)

if [ $ERROR_COUNT -eq 0 ]; then
    echo "✓ All Mermaid diagrams validated successfully"
    exit 0
else
    echo "✗ Found $ERROR_COUNT error(s) in Mermaid diagrams"
    exit 1
fi
