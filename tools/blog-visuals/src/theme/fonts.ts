export const fonts = {
  body: {
    family: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  code: {
    family: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
    },
  },
} as const;

// Google Fonts URLs for loading in Remotion
export const fontUrls = [
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap",
];
