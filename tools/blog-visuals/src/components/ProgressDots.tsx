import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors } from "../theme";

export const ProgressDots: React.FC<{
  totalSteps: number;
  currentStepFrame: number;
  framesPerStep: number;
}> = ({ totalSteps, currentStepFrame, framesPerStep }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 8,
      }}
    >
      {Array.from({ length: totalSteps }).map((_, i) => {
        const stepStart = i * framesPerStep;
        const isActive = frame >= stepStart;
        const scale = interpolate(
          frame,
          [stepStart, stepStart + 5],
          [0.5, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: isActive ? colors.marine : colors.gray500,
              transform: `scale(${scale})`,
              transition: "background-color 0.2s",
            }}
          />
        );
      })}
    </div>
  );
};
