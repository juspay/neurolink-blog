import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts, gifLayout } from "../theme";

// Simple syntax highlighting colors matching the blog dark theme
const syntaxColors: Record<string, string> = {
  keyword: "#f87171",
  string: "#4ade80",
  function: "#c084fc",
  type: "#4db5e8",
  comment: "#7f848e",
  operator: "#e5e5e5",
  default: "#e5e5e5",
};

interface Token {
  text: string;
  type: keyof typeof syntaxColors;
}

export interface CodeLine {
  tokens: Token[];
  indent: number;
}

export const CodeEditor: React.FC<{
  lines: CodeLine[];
  filename: string;
  framesPerLine?: number;
}> = ({ lines, filename, framesPerLine = 8 }) => {
  const frame = useCurrentFrame();
  const { codeEditor } = gifLayout;

  return (
    <div
      style={{
        position: "absolute",
        top: gifLayout.padding,
        left: gifLayout.padding,
        right: gifLayout.padding,
        bottom: gifLayout.padding,
        backgroundColor: "#151515",
        borderRadius: codeEditor.borderRadius,
        border: "1px solid #2a2a2a",
        overflow: "hidden",
      }}
    >
      {/* Editor header */}
      <div
        style={{
          height: codeEditor.headerHeight,
          backgroundColor: "#111111",
          borderBottom: "1px solid #2a2a2a",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#eab308" }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" }} />
        </div>
        <span
          style={{
            color: colors.gray500,
            fontSize: 12,
            fontFamily: fonts.code.family,
          }}
        >
          {filename}
        </span>
      </div>

      {/* Code content */}
      <div style={{ padding: "16px 20px" }}>
        {lines.map((line, lineIndex) => {
          const lineAppearFrame = lineIndex * framesPerLine;
          const opacity = interpolate(
            frame,
            [lineAppearFrame, lineAppearFrame + 4],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={lineIndex}
              style={{
                fontFamily: fonts.code.family,
                fontSize: codeEditor.fontSize,
                lineHeight: codeEditor.lineHeight,
                opacity,
                whiteSpace: "pre",
              }}
            >
              {/* Line number */}
              <span style={{ color: colors.gray500, marginRight: 16, userSelect: "none" }}>
                {String(lineIndex + 1).padStart(2, " ")}
              </span>
              {/* Indent */}
              {"  ".repeat(line.indent)}
              {/* Tokens */}
              {line.tokens.map((token, ti) => (
                <span key={ti} style={{ color: syntaxColors[token.type] || syntaxColors.default }}>
                  {token.text}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
