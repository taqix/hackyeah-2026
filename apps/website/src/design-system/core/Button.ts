// Ported from design/system/components.js (components/core/Button.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";
import { useInteraction } from "./useInteraction";
import { Icon } from "./Icon";

const SIZES = {
  sm: {
    h: 36,
    px: 14,
    f: "var(--text-sm)",
    ic: 16,
    gap: 6
  },
  md: {
    h: 48,
    px: 20,
    f: "var(--text-base)",
    ic: 18,
    gap: 8
  },
  lg: {
    h: 56,
    px: 26,
    f: "var(--text-md)",
    ic: 20,
    gap: 10
  }
};
function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  fullWidth = false,
  disabled = false,
  type = "button",
  onClick,
  children,
  style
}: { variant?: "primary" | "secondary" | "ghost" | "inverse"; size?: "sm" | "md" | "lg"; icon?: string; iconRight?: string; fullWidth?: boolean; disabled?: boolean; type?: "button" | "submit" | "reset"; onClick?: React.MouseEventHandler<HTMLButtonElement>; children?: React.ReactNode; style?: React.CSSProperties }) {
  const {
    hover,
    pressed,
    bind
  } = useInteraction(disabled);
  const s = SIZES[size] || SIZES.md;
  const v = {
    primary: {
      bg: pressed ? "var(--accent-pressed)" : hover ? "var(--accent-hover)" : "var(--accent)",
      fg: "var(--text-on-accent)",
      bd: "transparent"
    },
    secondary: {
      bg: hover ? "var(--surface-sunken)" : "var(--surface-card)",
      fg: "var(--text-primary)",
      bd: "var(--border-strong)"
    },
    ghost: {
      bg: hover ? "var(--surface-sunken)" : "transparent",
      fg: "var(--text-primary)",
      bd: "transparent"
    },
    inverse: {
      bg: "var(--surface-inverse)",
      fg: "var(--text-inverse)",
      bd: "transparent",
      op: hover ? 0.88 : 1
    }
  }[variant] || {};
  return /*#__PURE__*/React.createElement("button", { ...{
    type: type,
    disabled: disabled,
    onClick: disabled ? undefined : onClick
  }, ...bind, ...{
    style: {
      display: fullWidth ? "flex" : "inline-flex",
      width: fullWidth ? "100%" : undefined,
      alignItems: "center",
      justifyContent: "center",
      gap: s.gap,
      height: s.h,
      padding: "0 " + s.px + "px",
      borderRadius: "var(--radius-pill)",
      border: "1px solid " + v.bd,
      background: v.bg,
      color: v.fg,
      font: "600 " + s.f + "/1 var(--font-body)",
      letterSpacing: "-0.005em",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : v.op ?? 1,
      transform: pressed ? "scale(var(--press-scale))" : "none",
      transition: "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)",
      whiteSpace: "nowrap",
      ...style
    }
  } }, icon ? /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: s.ic
  }) : null, children, iconRight ? /*#__PURE__*/React.createElement(Icon, {
    name: iconRight,
    size: s.ic
  }) : null);
}

export { Button };
