// Ported from design/system/components.js (components/forms/Radio.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";

function useHP(disabled: boolean): [boolean, boolean, React.HTMLAttributes<HTMLElement>] {
  const [h, setH] = React.useState(false);
  const [p, setP] = React.useState(false);
  return [h, p, disabled ? {} : {
    onMouseEnter: () => setH(true),
    onMouseLeave: () => {
      setH(false);
      setP(false);
    },
    onPointerDown: () => setP(true),
    onPointerUp: () => setP(false)
  }];
}
function Choice({
  variant,
  checked,
  label,
  description,
  disabled,
  onClick,
  indicator,
  style
}: { variant?: string; checked?: boolean; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean; onClick?: () => void; indicator?: (hover: boolean) => React.ReactNode; style?: React.CSSProperties }) {
  const [hover, pressed, bind] = useHP(disabled);
  const card = variant === "card";
  const key = e => {
    if (!disabled && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      onClick && onClick();
    }
  };
  const text = label || description ? /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: (card ? "600 " : "500 ") + "var(--text-base)/1.3 var(--font-body)",
      color: "var(--text-primary)"
    }
  }, label) : null, description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body-sm)",
      color: "var(--text-tertiary)"
    }
  }, description) : null) : null;
  return /*#__PURE__*/React.createElement("div", { ...{
    role: "radio",
    "aria-checked": checked,
    "aria-disabled": disabled || undefined,
    tabIndex: disabled ? -1 : 0,
    onClick: disabled ? undefined : onClick,
    onKeyDown: key
  }, ...bind, ...{
    style: {
      display: "flex",
      alignItems: description ? "flex-start" : "center",
      gap: 14,
      minHeight: card ? 60 : 48,
      padding: card ? "14px 16px" : "10px 0",
      borderRadius: card ? "var(--radius-md)" : 0,
      background: card ? checked ? "var(--accent-soft)" : hover ? "var(--surface-sunken)" : "var(--surface-card)" : "transparent",
      boxShadow: card ? checked ? "inset 0 0 0 1.5px var(--accent)" : "inset 0 0 0 1px var(--border-strong)" : "none",
      transform: pressed ? "scale(0.985)" : "none",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      outline: "none",
      transition: "background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
      ...style
    }
  } }, card ? null : indicator(hover), text, card ? indicator(hover) : null);
}
function Radio({
  checked = false,
  label,
  description,
  variant = "row",
  disabled = false,
  onChange,
  style
}: { checked?: boolean; label?: React.ReactNode; description?: React.ReactNode; variant?: "row" | "card"; disabled?: boolean; onChange?: (checked: boolean) => void; style?: React.CSSProperties }) {
  const ind = hover => /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      flex: "none",
      borderRadius: 99,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      marginTop: description ? 0 : undefined,
      background: "var(--surface-card)",
      border: checked ? "2px solid var(--accent)" : "1.5px solid " + (hover ? "var(--text-tertiary)" : "var(--border-strong)"),
      boxShadow: checked ? "0 0 0 4px var(--accent-soft-strong)" : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 99,
      background: "var(--accent)",
      transform: checked ? "scale(1)" : "scale(0)",
      transition: "transform var(--dur-slow) var(--ease-spring)"
    }
  }));
  return /*#__PURE__*/React.createElement(Choice, {
    variant: variant,
    checked: checked,
    label: label,
    description: description,
    disabled: disabled,
    onClick: () => onChange && onChange(true),
    indicator: ind,
    style: style
  });
}

export { Radio };
