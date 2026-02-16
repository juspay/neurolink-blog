import React from "react";
import { AbsoluteFill } from "remotion";
import { CodeEditor, type CodeLine } from "../components/CodeEditor";
import { FontLoader } from "../components/FontLoader";
import { gradients } from "../theme";

export interface CodeWalkthroughProps extends Record<string, unknown> {
  code: string; // Raw code (used to generate lines if no parsed lines provided)
  language: string;
  filename: string;
  lines?: CodeLine[];
}

export const CodeWalkthrough: React.FC<CodeWalkthroughProps> = ({
  filename,
  lines = [],
}) => {
  return (
    <FontLoader>
      <AbsoluteFill style={{ background: gradients.dark }}>
        <CodeEditor lines={lines} filename={filename} framesPerLine={8} />
      </AbsoluteFill>
    </FontLoader>
  );
};
