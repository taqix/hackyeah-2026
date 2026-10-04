// Ported from design/system/components.js (components/fitness/SuggestionCard.jsx).
// A photo-led banner: an editorial headline over an image (or a warm grain texture), one
// light action plus an optional quiet one, and an optional dismiss. Children render last.
// The actions use the shared `useInteraction` hook rather than writing to `style` directly.
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";
import { transition } from "../core/tokens";
import { useInteraction } from "../core/useInteraction";

export type SuggestionTone = "dusk" | "dawn" | "sage";
export type SuggestionSize = "md" | "lg";

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const TONES: Record<SuggestionTone, string> = {
  dusk: "radial-gradient(60% 90% at 18% 30%, #2C5E8C 0%, transparent 70%), radial-gradient(45% 70% at 78% 65%, #C9894A 0%, transparent 70%), radial-gradient(40% 60% at 55% 15%, #4C7FB8 0%, transparent 70%), #1B2A3A",
  dawn: "radial-gradient(55% 80% at 80% 30%, #E7B58A 0%, transparent 70%), radial-gradient(60% 90% at 20% 70%, #5B8FD6 0%, transparent 70%), radial-gradient(40% 60% at 50% 100%, #B4513C 0%, transparent 70%), #2A3550",
  sage: "radial-gradient(60% 90% at 25% 35%, #6E8460 0%, transparent 70%), radial-gradient(45% 70% at 80% 60%, #D9B37A 0%, transparent 70%), #233024",
};

/** The card sits on its own dark art, so its colours are fixed rather than themed.
    The solid action uses the slightly warmer paper white, as in design/system. */
const ON_ART = "#FBF8F2";
const ON_ART_INK = "#1D1914";
const ACTION_PAPER = "#FFFBF5";
const ACTION_PRESS_SCALE = ".97";

interface ActionButtonProps {
  label: string;
  onClick?: () => void;
  /** `solid` is the one action to take; `quiet` sits beside it. */
  tone: "solid" | "quiet";
}

function ActionButton({ label, onClick, tone }: ActionButtonProps) {
  const { hover, pressed, bind } = useInteraction(false);
  const solid = tone === "solid";
  return (
    <button
      type="button"
      onClick={onClick}
      {...bind}
      style={{
        height: 44,
        padding: solid ? "0 18px" : "0 14px",
        border: 0,
        borderRadius: "var(--radius-pill)",
        background: solid ? ACTION_PAPER : hover ? "rgba(251,248,242,.14)" : "transparent",
        color: solid ? ON_ART_INK : "rgba(251,248,242,.92)",
        font: "600 var(--text-base)/1 var(--font-body)",
        cursor: "pointer",
        transform: pressed ? `scale(${ACTION_PRESS_SCALE})` : undefined,
        transition: `${transition(["transform"])}, ${transition(["background"], "fast", null)}`,
      }}
    >
      {label}
    </button>
  );
}

export interface SuggestionCardProps {
  image?: string;
  imageAlt?: string;
  tone?: SuggestionTone;
  kicker?: ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onDismiss?: () => void;
  size?: SuggestionSize;
  children?: ReactNode;
  style?: CSSProperties;
}

export function SuggestionCard({
  image,
  imageAlt = "",
  tone = "dusk",
  kicker,
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  onDismiss,
  size = "md",
  children,
  style,
}: SuggestionCardProps) {
  const tall = size === "lg";
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-xl)",
        minHeight: tall ? 360 : 220,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: TONES[tone],
        color: ON_ART,
        isolation: "isolate",
        ...style,
      }}
    >
      {image ? (
        <img
          src={image}
          alt={imageAlt}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: -2 }}
        />
      ) : null}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          backgroundImage: GRAIN,
          opacity: image ? 0.18 : 0.35,
          mixBlendMode: "overlay",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background: "linear-gradient(to top, rgba(18,16,14,.72) 0%, rgba(18,16,14,.25) 55%, rgba(18,16,14,0) 100%)",
        }}
      />
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 36,
            height: 36,
            borderRadius: 99,
            border: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(20,18,16,.38)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            color: ON_ART,
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Icon name="x" size={18} strokeWidth={2} />
        </button>
      ) : null}
      <div style={{ padding: tall ? "24px 24px 24px" : "20px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {kicker ? (
          <span
            style={{
              alignSelf: "flex-start",
              font: "600 var(--text-xs)/1 var(--font-body)",
              padding: "6px 10px",
              borderRadius: 99,
              background: "rgba(251,248,242,.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            {kicker}
          </span>
        ) : null}
        <h3
          style={{
            font: `700 ${tall ? "34px" : "27px"}/1.08 var(--font-display)`,
            letterSpacing: "-0.02em",
            color: "inherit",
            margin: 0,
            textWrap: "balance",
          }}
        >
          {title}
        </h3>
        {body ? (
          <p style={{ font: "var(--type-body-sm)", fontSize: 15, color: "rgba(251,248,242,.9)", margin: 0, maxWidth: 420 }}>
            {body}
          </p>
        ) : null}
        {actionLabel || secondaryLabel ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
            {actionLabel ? <ActionButton tone="solid" label={actionLabel} onClick={onAction} /> : null}
            {secondaryLabel ? <ActionButton tone="quiet" label={secondaryLabel} onClick={onSecondary} /> : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
