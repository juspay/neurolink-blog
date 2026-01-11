# Assets Directory

This directory contains static assets for the Neurolink blog.

## Directory Structure

```
assets/
├── images/           # All image assets
│   ├── og-*.png      # Open Graph images for social sharing
│   └── *-demo.gif    # CLI demonstration GIFs
└── README.md         # This file
```

## Image Assets

### Open Graph Images (`og-*.png`)

These images are used for social media previews when blog posts are shared:

- `og-openrouter-guide.png` - OpenRouter integration guide
- `og-multimodal-tutorial.png` - Multimodal document processing tutorial
- `og-framework-comparison.png` - AI SDK framework comparison

**Dimensions:** 1200x630px (standard OG image size)

### CLI Demo GIFs (`*-demo.gif`)

Animated demonstrations of CLI features:

- `openrouter-demo.gif` - OpenRouter CLI usage demonstration
- `multimodal-demo.gif` - Multimodal document processing demonstration

## Usage in Blog Posts

Reference images in Jekyll posts using:

```markdown
![Alt text](/assets/images/filename.png)
```

For Open Graph images in front matter:

```yaml
image: /assets/images/og-post-name.png
```
