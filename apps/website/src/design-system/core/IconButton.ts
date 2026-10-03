// Ported from design/system/components.js (components/core/IconButton.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";
import { useInteraction } from "./useInteraction";
import { Icon } from "./Icon";

function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  disabled = false,
  onClick,
  style
}: { icon: string; label: string; variant?: string; size?: string; disabled?: boolean; onClick?: React.MouseEventHandler<HTMLButtonElement>; style?: React.CSSProperties }) {
  const {
    hover,
    pressed,
    bind
  } = useInteraction(disabled);
  const d = size === "sm" ? 36 : 44;
  const v = {
    ghost: {
      bg: hover ? "var(--surface-sunken)" : "transparent",
      fg: "var(--text-primary)",
      bd: "transparent"
    },
    secondary: {
      bg: hover ? "var(--surface-sunken)" : "var(--surface-card)",
      fg: "var(--text-primary)",
      bd: "var(--border-strong)"
    },
    primary: {
      bg: pressed ? "var(--accent-pressed)" : hover ? "var(--accent-hover)" : "var(--accent)",
      fg: "var(--text-on-accent)",
      bd: "transparent"
    }
  }[variant] || {};
  return /*#__PURE__*/React.createElement("button", { ...{
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: disabled ? undefined : onClick
  }, ...bind, ...{
    style: {
      width: d,
      height: d,
      flex: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-pill)",
      border: "1px solid " + v.bd,
      background: v.bg,
      color: v.fg,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      padding: 0,
      transform: pressed ? "scale(var(--press-scale))" : "none",
      transition: "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
      ...style
    }
  } }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === "sm" ? 18 : 20
  }));
}

export { IconButton };
