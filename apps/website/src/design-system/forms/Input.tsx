// Ported from design/system/components.js (components/forms/Input.jsx).
import { useId, useState, type ChangeEvent, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { transition } from "../core/tokens";

export interface InputProps {
  label?: ReactNode;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Shown under the field, and replaced by `error` when there is one. */
  hint?: ReactNode;
  error?: ReactNode;
  suffix?: ReactNode;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  disabled?: boolean;
  onChange?: (value: string, event?: ChangeEvent<HTMLInputElement>) => void;
  style?: CSSProperties;
}

export function Input({
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
  style,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;
  const borderColor = error ? "var(--danger)" : focused ? "var(--accent)" : "var(--border-strong)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      {label ? (
        <label htmlFor={id} style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>
          {label}
        </label>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 52,
          padding: "0 16px",
          gap: 8,
          borderRadius: "var(--radius-control)",
          background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
          border: `1px solid ${borderColor}`,
          boxShadow: focused ? "0 0 0 4px var(--focus-ring)" : "none",
          transition: transition(["border-color", "box-shadow"]),
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={event => onChange?.(event.target.value, event)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: "none",
            background: "transparent",
            color: "var(--text-primary)",
            font: "var(--type-body)",
            padding: 0,
          }}
        />
        {suffix ? <span style={{ font: "var(--type-label)", color: "var(--text-tertiary)" }}>{suffix}</span> : null}
      </div>
      {note ? (
        <span
          id={noteId}
          role={error ? "alert" : undefined}
          style={{ font: "var(--type-caption)", color: error ? "var(--danger-text)" : "var(--text-tertiary)" }}
        >
          {note}
        </span>
      ) : null}
    </div>
  );
}
