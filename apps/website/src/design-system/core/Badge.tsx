// Ported from design/system/components.js (components/core/Badge.jsx).
import type { CSSProperties, ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "recovery" | "success" | "danger" | "info";

const TONES: Record<BadgeTone, { background: string; color: string }> = {
  neutral: { background: "var(--surface-sunken)", color: "var(--text-secondary)" },
  accent: { background: "var(--accent-soft-strong)", color: "var(--accent-text)" },
  recovery: { background: "var(--recovery-soft)", color: "var(--text-secondary)" },
  success: { background: "var(--success-soft)", color: "var(--success-text)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger-text)" },
  info: { background: "var(--info-soft)", color: "var(--info-text)" },
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Shows a leading dot, for a status rather than a label. */
  dot?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}

export function Badge({ tone = "neutral", dot = false, children, style }: BadgeProps) {
  const { background, color } = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 10px",
        borderRadius: "var(--radius-pill)",
        background,
        color,
        font: "var(--type-caption)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot ? (
        <span style={{ width: 6, height: 6, borderRadius: 99, background: tone === "recovery" ? "var(--recovery)" : color }} />
      ) : null}
      {children}
    </span>
  );
}
