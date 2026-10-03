// Ported from design/system/components.js (components/core/Tag.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";
import { useInteraction } from "./useInteraction";
import { Icon } from "./Icon";

function Tag({
  selected = false,
  icon,
  disabled = false,
  onClick,
  children,
  style
}: { selected?: boolean; icon?: string; disabled?: boolean; onClick?: React.MouseEventHandler<HTMLButtonElement>; children?: React.ReactNode; style?: React.CSSProperties }) {
  const {
    hover,
    pressed,
    bind
  } = useInteraction(disabled);
  return /*#__PURE__*/React.createElement("button", { ...{
    type: "button",
    "aria-pressed": selected,
    disabled: disabled,
    onClick: disabled ? undefined : onClick
  }, ...bind, ...{
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 40,
      padding: "0 16px",
      borderRadius: "var(--radius-pill)",
      border: "1px solid " + (selected ? "var(--surface-inverse)" : "var(--border-strong)"),
      background: selected ? "var(--surface-inverse)" : hover ? "var(--surface-sunken)" : "var(--surface-card)",
      color: selected ? "var(--text-inverse)" : "var(--text-primary)",
      font: "var(--type-label)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transform: pressed ? "scale(var(--press-scale))" : "none",
      transition: "all var(--dur-fast) var(--ease-out)",
      ...style
    }
  } }, icon ? /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  }) : null, children);
}

export { Tag };
