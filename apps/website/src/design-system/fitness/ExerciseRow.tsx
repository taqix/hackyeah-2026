// Ported from design/system/components.js (components/fitness/ExerciseRow.jsx).
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Icon } from "../core/Icon";
import { transition } from "../core/tokens";
import { ExerciseMedia } from "./ExerciseMedia";

export interface ExerciseRowProps {
  name: string;
  detail?: ReactNode;
  meta?: ReactNode;
  done?: boolean;
  /** Shows the media slot even without a `mediaSrc`, as a placeholder. */
  media?: boolean;
  mediaSrc?: string;
  mediaIcon?: string;
  onToggle?: () => void;
  /** Makes the name and media open the exercise; the toggle stays separate. */
  onOpen?: () => void;
  divider?: boolean;
  style?: CSSProperties;
}

export function ExerciseRow({
  name,
  detail,
  meta,
  done = false,
  media,
  mediaSrc,
  mediaIcon,
  onToggle,
  onOpen,
  divider = true,
  style,
}: ExerciseRowProps) {
  const showMedia = media || !!mediaSrc;

  const open = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onOpen();
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        minHeight: 72,
        padding: "12px 0",
        borderBottom: divider ? "1px solid var(--border-subtle)" : "none",
        ...style,
      }}
    >
      <div
        onClick={onOpen}
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onKeyDown={onOpen ? open : undefined}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 14, cursor: onOpen ? "pointer" : undefined }}
      >
        {showMedia ? (
          <ExerciseMedia
            src={mediaSrc}
            alt={name}
            icon={mediaIcon}
            size={52}
            style={{ opacity: done ? 0.5 : 1, transition: transition(["opacity"], "base", null) }}
          />
        ) : null}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              font: "600 var(--text-base)/1.3 var(--font-body)",
              color: done ? "var(--text-tertiary)" : "var(--text-primary)",
              transition: transition(["color"], "base", null),
            }}
          >
            {name}
          </span>
          {detail || meta ? (
            <span style={{ font: "var(--type-body-sm)", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
              {detail}
              {detail && meta ? <span style={{ color: "var(--text-tertiary)" }}> · {meta}</span> : meta}
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        aria-label={done ? "Mark not done" : "Mark done"}
        aria-pressed={done}
        onClick={onToggle}
        style={{
          width: 44,
          height: 44,
          marginRight: -8,
          flex: "none",
          border: 0,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 99,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: done ? "var(--accent)" : "transparent",
            border: `1.5px solid ${done ? "var(--accent)" : "var(--border-strong)"}`,
            color: "var(--text-on-accent)",
            transform: done ? "scale(1)" : "scale(.96)",
            transition: transition(["all"], "slow", "spring"),
          }}
        >
          {done ? <Icon name="check" size={15} strokeWidth={2.5} /> : null}
        </span>
      </button>
    </div>
  );
}
