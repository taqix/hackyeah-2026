import { useId, type CSSProperties } from "react";

/* The app icon (design/icons.html, "Monitor"): a heartbeat whose beat is the M, with the o as
   a bright dot at its tip. The hex values mirror the icon's export, which does not change
   between light and dark. */
const INK = "#1D1914";
const BEAT = "#86AEE3";
const PAPER = "#FFFBF5";

export function AppIcon({ size = 32, style }: { size?: number; style?: CSSProperties }) {
  const gradientId = `s-icon-${useId().replace(/:/g, "")}`;
  return (
    <svg className="s-appicon" viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" style={style}>
      <rect width="120" height="120" fill={INK} />
      <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="8" x2="92" y1="0" y2="0">
        <stop offset="0" stopColor={BEAT} stopOpacity="0" />
        <stop offset=".55" stopColor={BEAT} />
      </linearGradient>
      <path
        d="M8 70H24L36 38L54 76L72 38L84 70H92"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="102" cy="70" r="16" fill={PAPER} opacity=".22" />
      <circle cx="102" cy="70" r="8.5" fill={PAPER} />
    </svg>
  );
}
