import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FontLoader } from "../components/FontLoader";
import { ProgressDots } from "../components/ProgressDots";
import { colors, fonts, gradients, gifLayout } from "../theme";

export interface ConceptStep {
  label: string;
  icon: string; // Emoji or text symbol
  description?: string;
  x: number;
  y: number;
}

export interface ConceptExplainerProps extends Record<string, unknown> {
  concept: string;
  steps: ConceptStep[];
}

export const ConceptExplainer: React.FC<ConceptExplainerProps> = ({
  concept,
  steps,
}) => {
  const frame = useCurrentFrame();
  const framesPerStep = 15;

  return (
    <FontLoader>
      <AbsoluteFill style={{ background: gradients.dark }}>
        {/* Concept title */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: gifLayout.padding,
            color: colors.white,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: fonts.body.family,
          }}
        >
          {concept}
        </div>

        {/* Animated steps */}
        {steps.map((step, i) => {
          const stepStart = i * framesPerStep;
          const opacity = interpolate(
            frame,
            [stepStart, stepStart + 8],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const translateY = interpolate(
            frame,
            [stepStart, stepStart + 8],
            [20, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: step.x,
                top: step.y,
                opacity,
                transform: `translateY(${translateY}px)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: colors.marine,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  boxShadow: `0 0 16px ${colors.marine}40`,
                }}
              >
                {step.icon}
              </div>
              <span
                style={{
                  color: colors.white,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: fonts.body.family,
                  textAlign: "center",
                  maxWidth: 100,
                }}
              >
                {step.label}
              </span>
              {step.description && (
                <span
                  style={{
                    color: colors.gray400,
                    fontSize: 11,
                    fontFamily: fonts.body.family,
                    textAlign: "center",
                    maxWidth: 120,
                  }}
                >
                  {step.description}
                </span>
              )}
            </div>
          );
        })}

        {/* Connection lines between steps */}
        {steps.slice(0, -1).map((step, i) => {
          const next = steps[i + 1];
          const lineStart = (i + 1) * framesPerStep - 5;
          const opacity = interpolate(
            frame,
            [lineStart, lineStart + 5],
            [0, 0.4],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <svg
              key={`line-${i}`}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            >
              <line
                x1={step.x + 28}
                y1={step.y + 56}
                x2={next.x + 28}
                y2={next.y}
                stroke={colors.saffron}
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={opacity}
              />
            </svg>
          );
        })}

        {/* Progress dots */}
        <ProgressDots
          totalSteps={steps.length}
          currentStepFrame={0}
          framesPerStep={framesPerStep}
        />
      </AbsoluteFill>
    </FontLoader>
  );
};
