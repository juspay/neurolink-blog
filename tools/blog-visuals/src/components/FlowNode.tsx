import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts, gifLayout } from "../theme";

export interface FlowNodeData {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
  appearFrame: number;
}

export const FlowNode: React.FC<FlowNodeData> = ({
  label,
  x,
  y,
  color = colors.marine,
  appearFrame,
}) => {
  const frame = useCurrentFrame();
  const { node } = gifLayout;

  const opacity = interpolate(frame, [appearFrame, appearFrame + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [appearFrame, appearFrame + 8], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x - node.width / 2,
        top: y - node.height / 2,
        width: node.width,
        height: node.height,
        backgroundColor: color,
        borderRadius: node.borderRadius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${scale})`,
        boxShadow: `0 0 20px ${color}40`,
      }}
    >
      <span
        style={{
          color: colors.white,
          fontSize: node.fontSize,
          fontWeight: node.fontWeight,
          fontFamily: fonts.body.family,
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </div>
  );
};
