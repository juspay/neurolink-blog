import React from "react";
import { heroLayout, fonts, colors } from "../theme";

export const Title: React.FC<{ text: string }> = ({ text }) => {
  const { title } = heroLayout;

  return (
    <div
      style={{
        color: colors.white,
        fontSize: title.fontSize,
        fontWeight: title.fontWeight,
        fontFamily: fonts.body.family,
        lineHeight: title.lineHeight,
        maxWidth: heroLayout.width - heroLayout.padding.horizontal * 2,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: title.maxLines,
        WebkitBoxOrient: "vertical",
        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}
    >
      {text}
    </div>
  );
};
