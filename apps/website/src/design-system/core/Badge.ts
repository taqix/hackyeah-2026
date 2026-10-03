// Ported from design/system/components.js (components/core/Badge.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";

const TONES = {
  neutral: ["var(--surface-sunken)", "var(--text-secondary)"],
  accent: ["var(--accent-soft-strong)", "var(--accent-text)"],
  recovery: ["var(--recovery-soft)", "var(--text-secondary)"],
  success: ["var(--success-soft)", "var(--success-text)"],
  danger: ["var(--danger-soft)", "var(--danger-text)"],
  info: ["var(--info-soft)", "var(--info-text)"]
};
function Badge({
  tone = "neutral",
  dot = false,
  children,
  style
}: { tone?: "neutral" | "accent" | "recovery" | "success" | "danger" | "info"; dot?: boolean; children?: React.ReactNode; style?: React.CSSProperties }) {
  const [bg, fg] = TONES[tone] || TONES.neutral;
  const dotColor = tone === "recovery" ? "var(--recovery)" : fg;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 24,
      padding: "0 10px",
      borderRadius: "var(--radius-pill)",
      background: bg,
      color: fg,
      font: "var(--type-caption)",
      whiteSpace: "nowrap",
      ...style
    }
  }, dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 99,
      background: dotColor
    }
  }) : null, children);
}

export { Badge };
