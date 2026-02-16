export const heroLayout = {
  width: 1200,
  height: 630,
  padding: {
    horizontal: 60,
    vertical: 40,
  },
  title: {
    fontSize: 42,
    lineHeight: 1.2,
    maxLines: 3,
    fontWeight: 700,
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    paddingH: 16,
    paddingV: 6,
    borderRadius: 4,
    letterSpacing: "0.1em",
  },
  footer: {
    fontSize: 14,
    fontWeight: 500,
    logoSize: 32,
  },
} as const;

export const gifLayout = {
  width: 800,
  height: 450,
  padding: 32,
  node: {
    width: 140,
    height: 50,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  arrow: {
    strokeWidth: 2,
    particleSize: 6,
  },
  codeEditor: {
    fontSize: 14,
    lineHeight: 1.6,
    headerHeight: 36,
    borderRadius: 8,
  },
} as const;
