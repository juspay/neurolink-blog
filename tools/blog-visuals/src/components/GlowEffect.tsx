import React from "react";

export const GlowEffect: React.FC<{
  color: string;
  size: number;
  x: number;
  y: number;
  opacity?: number;
}> = ({ color, size, x, y, opacity = 0.4 }) => (
  <div
    style={{
      position: "absolute",
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      filter: `blur(${size / 3}px)`,
      opacity,
      pointerEvents: "none",
    }}
  />
);
