// Ported from design/system/components.js (components/core/IconButton.jsx).
import type { CSSProperties, MouseEventHandler } from "react";
import { Icon } from "./Icon";
import { DISABLED_OPACITY, pressTransform, transition } from "./tokens";
import { useInteraction } from "./useInteraction";
import { controlPalette } from "./variants";

export type IconButtonSize = "sm" | "md";

const DIAMETER: Record<IconButtonSize, number> = { sm: 36, md: 44 };
const ICON_SIZE: Record<IconButtonSize, number> = { sm: 18, md: 20 };

export interface IconButtonProps {
  icon: string;
  /** Always required: it is the button's only name, for screen readers and its tooltip. */
  label: string;
  variant?: "ghost" | "secondary" | "primary";
  size?: IconButtonSize;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
}

export function IconButton({ icon, label, variant = "ghost", size = "md", disabled = false, onClick, style }: IconButtonProps) {
  const { hover, pressed, bind } = useInteraction(disabled);
  const palette = controlPalette(variant, { hover, pressed });
  const diameter = DIAMETER[size];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      {...bind}
      style={{
        width: diameter,
        height: diameter,
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${palette.borderColor}`,
        background: palette.background,
        color: palette.color,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? DISABLED_OPACITY : 1,
        padding: 0,
        transform: pressTransform(pressed),
        transition: transition(["background", "transform"]),
        ...style,
      }}
    >
      <Icon name={icon} size={ICON_SIZE[size]} />
    </button>
  );
}
