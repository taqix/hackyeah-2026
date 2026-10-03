// Ported from design/system/components.js (components/core/Card.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";
import { useInteraction } from "./useInteraction";

const V = {
  default: {
    background: "var(--surface-card)",
    border: "1px solid var(--border-subtle)",
    boxShadow: "var(--shadow-card)"
  },
  sunken: {
    background: "var(--surface-sunken)",
    border: "1px solid transparent",
    boxShadow: "none"
  },
  accent: {
    background: "var(--accent-soft)",
    border: "1px solid transparent",
    boxShadow: "none"
  },
  outline: {
    background: "transparent",
    border: "1px solid var(--border-strong)",
    boxShadow: "none"
  }
};
function Card({
  variant = "default",
  padding = 20,
  onClick,
  children,
  style
}: { variant?: string; padding?: number; onClick?: React.MouseEventHandler<HTMLDivElement>; children?: React.ReactNode; style?: React.CSSProperties }) {
  const interactive = !!onClick;
  const {
    pressed,
    bind
  } = useInteraction(!interactive);
  return /*#__PURE__*/React.createElement("div", { ...{
    onClick: onClick,
    role: interactive ? "button" : undefined,
    tabIndex: interactive ? 0 : undefined
  }, ...bind, ...{
    style: {
      ...(V[variant] || V.default),
      borderRadius: "var(--radius-card)",
      padding,
      cursor: interactive ? "pointer" : undefined,
      transform: pressed ? "scale(0.99)" : "none",
      transition: "transform var(--dur-base) var(--ease-out)",
      ...style
    }
  } }, children);
}

export { Card };
