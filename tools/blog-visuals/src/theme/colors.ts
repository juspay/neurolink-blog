export const colors = {
  // Primary
  marine: "#016fb9",
  marinLight: "#0190e0",
  marineDark: "#014a7a",

  // Accents
  saffron: "#ff9505",
  paprika: "#ec4e20",

  // Neutrals
  charcoal: "#353531",
  charcoalLight: "#3d3d38",
  charcoalDark: "#2a2a27",
  black: "#000000",
  white: "#ffffff",

  // Grays
  gray400: "#94A3B8",
  gray500: "#64748B",

  // Status (from blog CSS)
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
} as const;

export const gradients = {
  marine: "linear-gradient(135deg, #0190e0 0%, #016fb9 100%)",
  dark: "linear-gradient(135deg, #2a2a27 0%, #353531 50%, #2a2a27 100%)",
  warm: "linear-gradient(135deg, #ff9505 0%, #ec4e20 100%)",
  overlay: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.1) 100%)",
} as const;

export type ToneCategory =
  | "tutorial"
  | "deep-dive"
  | "comparison"
  | "opinion"
  | "announcement"
  | "beginner";

export const categoryColors: Record<ToneCategory, { badge: string; accent: string }> = {
  tutorial: { badge: colors.marine, accent: colors.marinLight },
  "deep-dive": { badge: colors.charcoal, accent: colors.marine },
  comparison: { badge: colors.saffron, accent: colors.saffron },
  opinion: { badge: colors.paprika, accent: colors.paprika },
  announcement: { badge: colors.marine, accent: colors.saffron },
  beginner: { badge: colors.green, accent: colors.green },
};

export const categoryLabels: Record<ToneCategory, string> = {
  tutorial: "TUTORIAL",
  "deep-dive": "DEEP DIVE",
  comparison: "COMPARISON",
  opinion: "OPINION",
  announcement: "ANNOUNCEMENT",
  beginner: "GETTING STARTED",
};
