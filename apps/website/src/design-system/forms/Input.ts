// Ported from design/system/components.js (components/forms/Input.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";

function Input({
  label,
  value,
  defaultValue,
  placeholder,
  hint,
  error,
  suffix,
  type = "text",
  inputMode,
  autoComplete,
  disabled = false,
  onChange,
  style
}: { label?: React.ReactNode; value?: string; defaultValue?: string; placeholder?: string; hint?: React.ReactNode; error?: React.ReactNode; suffix?: React.ReactNode; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; autoComplete?: string; disabled?: boolean; onChange?: (value: string, event?: React.ChangeEvent<HTMLInputElement>) => void; style?: React.CSSProperties }) {
  const [focus, setFocus] = React.useState(false);
  const id = React.useId();
  const noteId = id + "-note";
  const bd = error ? "var(--danger)" : focus ? "var(--accent)" : "var(--border-strong)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      font: "var(--type-label)",
      color: "var(--text-secondary)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      height: 52,
      padding: "0 16px",
      gap: 8,
      borderRadius: "var(--radius-control)",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
      border: "1px solid " + bd,
      boxShadow: focus ? "0 0 0 4px var(--focus-ring)" : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
      opacity: disabled ? 0.6 : 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: id,
    type: type,
    inputMode: inputMode,
    autoComplete: autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hint ? noteId : undefined,
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value, e),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 0,
      outline: "none",
      background: "transparent",
      color: "var(--text-primary)",
      font: "var(--type-body)",
      padding: 0
    }
  }), suffix ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--text-tertiary)"
    }
  }, suffix) : null), error || hint ? /*#__PURE__*/React.createElement("span", {
    id: noteId,
    role: error ? "alert" : undefined,
    style: {
      font: "var(--type-caption)",
      color: error ? "var(--danger-text)" : "var(--text-tertiary)"
    }
  }, error || hint) : null);
}

export { Input };
