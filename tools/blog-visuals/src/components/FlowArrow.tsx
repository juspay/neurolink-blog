import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, gifLayout } from "../theme";

export interface FlowArrowData {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color?: string;
  appearFrame: number;
  particleFrame: number;
}

export const FlowArrow: React.FC<FlowArrowData> = ({
  fromX,
  fromY,
  toX,
  toY,
  color = colors.saffron,
  appearFrame,
  particleFrame,
}) => {
  const frame = useCurrentFrame();
  const { arrow } = gifLayout;

  const lineOpacity = interpolate(frame, [appearFrame, appearFrame + 5], [0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Particle travels along the line
  const totalFrames = 20;
  const particleProgress = interpolate(
    frame,
    [particleFrame, particleFrame + totalFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const particleX = fromX + (toX - fromX) * particleProgress;
  const particleY = fromY + (toY - fromY) * particleProgress;
  const particleOpacity =
    frame >= particleFrame && frame <= particleFrame + totalFrames ? 1 : 0;

  const angle = Math.atan2(toY - fromY, toX - fromX);
  const length = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);

  return (
    <>
      {/* Line */}
      <div
        style={{
          position: "absolute",
          left: fromX,
          top: fromY - arrow.strokeWidth / 2,
          width: length,
          height: arrow.strokeWidth,
          backgroundColor: color,
          opacity: lineOpacity,
          transform: `rotate(${angle}rad)`,
          transformOrigin: "0 50%",
        }}
      />
      {/* Glowing particle */}
      <div
        style={{
          position: "absolute",
          left: particleX - arrow.particleSize / 2,
          top: particleY - arrow.particleSize / 2,
          width: arrow.particleSize,
          height: arrow.particleSize,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}, 0 0 24px ${color}80`,
          opacity: particleOpacity,
        }}
      />
    </>
  );
};
