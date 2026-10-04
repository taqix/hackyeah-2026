// Ported from design/system/components.js (components/core/Button.jsx).
// One addition for the website: with `href` it renders a link that looks the same, for
// buttons that go to another page.
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Icon } from "./Icon";
import { DISABLED_OPACITY, pressTransform, transition } from "./tokens";
import { useInteraction } from "./useInteraction";
import { controlPalette, type ControlVariant } from "./variants";

export type ButtonSize = "sm" | "md" | "lg";

interface SizeSpec {
  height: number;
  paddingX: number;
  font: string;
  icon: number;
  gap: number;
}

const SIZES: Record<ButtonSize, SizeSpec> = {
  sm: { height: 36, paddingX: 14, font: "var(--text-sm)", icon: 16, gap: 6 },
  md: { height: 48, paddingX: 20, font: "var(--text-base)", icon: 18, gap: 8 },
  lg: { height: 56, paddingX: 26, font: "var(--text-md)", icon: 20, gap: 10 },
};

interface ButtonLook {
  variant?: ControlVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}

/** A button that acts on the page. */
interface ActionProps {
  href?: undefined;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

/** A link to another page, which cannot be disabled or submit a form. */
interface LinkProps {
  href: string;
  disabled?: never;
  type?: never;
  onClick?: never;
}

export type ButtonProps = ButtonLook & (ActionProps | LinkProps);

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  fullWidth = false,
  disabled = false,
  type = "button",
  onClick,
  href,
  children,
  style,
}: ButtonProps) {
  const { hover, pressed, bind } = useInteraction(disabled);
  const spec = SIZES[size];
  const palette = controlPalette(variant, { hover, pressed });
  const look: CSSProperties = {
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    gap: spec.gap,
    height: spec.height,
    padding: `0 ${spec.paddingX}px`,
    borderRadius: "var(--radius-pill)",
    border: `1px solid ${palette.borderColor}`,
    background: palette.background,
    color: palette.color,
    font: `600 ${spec.font}/1 var(--font-body)`,
    letterSpacing: "-0.005em",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? DISABLED_OPACITY : palette.opacity ?? 1,
    transform: pressTransform(pressed),
    transition: transition(["background", "transform", "opacity"]),
    whiteSpace: "nowrap",
    ...style,
  };
  const content = (
    <>
      {icon ? <Icon name={icon} size={spec.icon} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={spec.icon} /> : null}
    </>
  );
  if (href !== undefined) {
    return (
      <a href={href} {...bind} style={{ textDecoration: "none", ...look }}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={disabled ? undefined : onClick} {...bind} style={look}>
      {content}
    </button>
  );
}
