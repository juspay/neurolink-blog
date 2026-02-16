import React from "react";
import { colors, fonts, heroLayout } from "../theme";

export const BrandFooter: React.FC = () => {
  const { footer } = heroLayout;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <span
        style={{
          color: colors.gray400,
          fontSize: footer.fontSize,
          fontWeight: footer.fontWeight,
          fontFamily: fonts.body.family,
        }}
      >
        neurolink.ink/blog
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            color: colors.white,
            fontSize: 18,
            fontWeight: 700,
            fontFamily: fonts.body.family,
          }}
        >
          Neuro
        </span>
        <span
          style={{
            color: colors.saffron,
            fontSize: 18,
            fontWeight: 700,
            fontFamily: fonts.body.family,
          }}
        >
          Link
        </span>
      </div>
    </div>
  );
};
