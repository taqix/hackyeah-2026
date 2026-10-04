// Ported from design/system/components.js (components/fitness/ExerciseMedia.jsx).
// An exercise image or GIF slot, falling back to a quiet placeholder.
import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export type MediaShape = "circle" | "frame";

export interface ExerciseMediaProps {
  src?: string;
  alt?: string;
  shape?: MediaShape;
  /** Diameter of the circle shape; the frame shape fills its column instead. */
  size?: number;
  ratio?: string;
  playing?: boolean;
  label?: string;
  icon?: string;
  style?: CSSProperties;
}

export function ExerciseMedia({
  src,
  alt = "",
  shape = "circle",
  size = 52,
  ratio = "1 / 1",
  playing = true,
  label,
  icon,
  style,
}: ExerciseMediaProps) {
  const circle = shape === "circle";
  const box: CSSProperties = circle
    ? { width: size, height: size, borderRadius: "var(--radius-pill)", flex: "none" }
    : { width: "100%", aspectRatio: ratio, borderRadius: "var(--radius-card)" };
  return (
    <div
      style={{
        ...box,
        position: "relative",
        overflow: "hidden",
        background: "var(--surface-sunken)",
        boxShadow: "inset 0 0 0 1px var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {src ? (
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--text-tertiary)" }}>
          <Icon name={icon || (circle ? "dumbbell" : "film")} size={circle ? Math.round(size * 0.4) : 28} strokeWidth={1.5} />
          {circle ? null : <span style={{ font: "var(--type-caption)" }}>{label || "Exercise animation"}</span>}
        </div>
      )}
      {!circle && src ? (
        <span
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            height: 28,
            padding: "0 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 99,
            background: "color-mix(in oklch, var(--surface-inverse) 72%, transparent)",
            color: "var(--text-inverse)",
            font: "var(--type-caption)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Icon name={playing ? "repeat" : "pause"} size={12} />
          {playing ? "Looping" : "Paused"}
        </span>
      ) : null}
    </div>
  );
}
