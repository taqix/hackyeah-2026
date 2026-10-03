// Ported from design/system/components.js (components/fitness/ProgressRing.jsx).
import type { CSSProperties, ReactNode } from "react";
import { transition } from "../core/tokens";

export interface ProgressRingProps {
  /** 0–1; anything outside is clamped. */
  value?: number;
  size?: number;
  stroke?: number;
  /** Text in the middle, when no children are given. */
  label?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}

export function ProgressRing({ value = 0, size = 56, stroke = 5, label, children, style }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, value));
  const centre = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none", ...style }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={centre} cy={centre} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={stroke} />
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: transition(["stroke-dashoffset"], "calm") }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: `600 ${Math.round(size * 0.26)}px/1 var(--font-numeric)`,
          color: "var(--text-primary)",
        }}
      >
        {children ?? label}
      </div>
    </div>
  );
}
