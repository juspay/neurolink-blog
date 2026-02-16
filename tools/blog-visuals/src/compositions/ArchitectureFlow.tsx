import React from "react";
import { AbsoluteFill } from "remotion";
import { FlowNode, type FlowNodeData } from "../components/FlowNode";
import { FlowArrow, type FlowArrowData } from "../components/FlowArrow";
import { FontLoader } from "../components/FontLoader";
import { colors, gradients } from "../theme";

export interface ArchitectureFlowProps extends Record<string, unknown> {
  nodes: FlowNodeData[];
  connections: FlowArrowData[];
  title?: string;
}

export const ArchitectureFlow: React.FC<ArchitectureFlowProps> = ({
  nodes,
  connections,
  title,
}) => {
  return (
    <FontLoader>
      <AbsoluteFill
        style={{
          background: gradients.dark,
        }}
      >
        {/* Optional title */}
        {title && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 32,
              color: colors.gray400,
              fontSize: 14,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 500,
            }}
          >
            {title}
          </div>
        )}

        {/* Render connections behind nodes */}
        {connections.map((conn, i) => (
          <FlowArrow key={`arrow-${i}`} {...conn} />
        ))}

        {/* Render nodes */}
        {nodes.map((node) => (
          <FlowNode key={node.id} {...node} />
        ))}
      </AbsoluteFill>
    </FontLoader>
  );
};
