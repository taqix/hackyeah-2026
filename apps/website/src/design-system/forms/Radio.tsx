// Ported from design/system/components.js (components/forms/Radio.jsx).
import type { CSSProperties, ReactNode } from "react";
import { transition } from "../core/tokens";
import { Choice, type ChoiceVariant } from "./Choice";

export interface RadioProps {
  checked?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  variant?: ChoiceVariant;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  style?: CSSProperties;
}

export function Radio({ checked = false, label, description, variant = "row", disabled = false, onChange, style }: RadioProps) {
  const indicator = (hover: boolean) => (
    <span
      style={{
        width: 24,
        height: 24,
        flex: "none",
        borderRadius: 99,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: description ? 0 : undefined,
        background: "var(--surface-card)",
        border: checked ? "2px solid var(--accent)" : `1.5px solid ${hover ? "var(--text-tertiary)" : "var(--border-strong)"}`,
        boxShadow: checked ? "0 0 0 4px var(--accent-soft-strong)" : "none",
        transition: `${transition(["border-color"])}, ${transition(["box-shadow"], "base")}`,
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 99,
          background: "var(--accent)",
          transform: checked ? "scale(1)" : "scale(0)",
          transition: transition(["transform"], "slow", "spring"),
        }}
      />
    </span>
  );

  return (
    <Choice
      variant={variant}
      checked={checked}
      label={label}
      description={description}
      disabled={disabled}
      onClick={() => onChange?.(true)}
      indicator={indicator}
      style={style}
    />
  );
}
