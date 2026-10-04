// Ported from design/system/components.js (components/core/Tag.jsx).
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Icon } from "./Icon";
import { DISABLED_OPACITY, pressTransform, transition } from "./tokens";
import { useInteraction } from "./useInteraction";

export interface TagProps {
  selected?: boolean;
  icon?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
  style?: CSSProperties;
}

export function Tag({ selected = false, icon, disabled = false, onClick, children, style }: TagProps) {
  const { hover, pressed, bind } = useInteraction(disabled);
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      {...bind}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 16px",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${selected ? "var(--surface-inverse)" : "var(--border-strong)"}`,
        background: selected ? "var(--surface-inverse)" : hover ? "var(--surface-sunken)" : "var(--surface-card)",
        color: selected ? "var(--text-inverse)" : "var(--text-primary)",
        font: "var(--type-label)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? DISABLED_OPACITY : 1,
        transform: pressTransform(pressed),
        transition: transition(["all"]),
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
