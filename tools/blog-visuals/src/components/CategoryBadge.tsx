import React from "react";
import { categoryColors, categoryLabels, type ToneCategory } from "../theme";
import { heroLayout } from "../theme";

export const CategoryBadge: React.FC<{ category: ToneCategory }> = ({ category }) => {
  const { badge } = categoryColors[category];
  const label = categoryLabels[category];
  const { badge: badgeLayout } = heroLayout;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: badge,
        color: "#ffffff",
        fontSize: badgeLayout.fontSize,
        fontWeight: badgeLayout.fontWeight,
        fontFamily: "'IBM Plex Sans', sans-serif",
        letterSpacing: badgeLayout.letterSpacing,
        paddingLeft: badgeLayout.paddingH,
        paddingRight: badgeLayout.paddingH,
        paddingTop: badgeLayout.paddingV,
        paddingBottom: badgeLayout.paddingV,
        borderRadius: badgeLayout.borderRadius,
      }}
    >
      {label}
    </div>
  );
};
