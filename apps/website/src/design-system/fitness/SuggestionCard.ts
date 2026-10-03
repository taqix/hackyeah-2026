// Ported from design/system/components.js (components/fitness/SuggestionCard.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";
import { Icon } from "../core/Icon";

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
const TONES = {
  dusk: "radial-gradient(60% 90% at 18% 30%, #2C5E8C 0%, transparent 70%), radial-gradient(45% 70% at 78% 65%, #C9894A 0%, transparent 70%), radial-gradient(40% 60% at 55% 15%, #4C7FB8 0%, transparent 70%), #1B2A3A",
  dawn: "radial-gradient(55% 80% at 80% 30%, #E7B58A 0%, transparent 70%), radial-gradient(60% 90% at 20% 70%, #5B8FD6 0%, transparent 70%), radial-gradient(40% 60% at 50% 100%, #B4513C 0%, transparent 70%), #2A3550",
  sage: "radial-gradient(60% 90% at 25% 35%, #6E8460 0%, transparent 70%), radial-gradient(45% 70% at 80% 60%, #D9B37A 0%, transparent 70%), #233024"
};
/** Photo-led suggestion banner: editorial serif headline over an image (or a warm grain texture), one light action plus an optional quiet secondary one, optional dismiss. Children render last (a progress bar, a row). */
function SuggestionCard({
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
  style
}: { image?: string; imageAlt?: string; tone?: string; kicker?: React.ReactNode; title?: React.ReactNode; body?: React.ReactNode; actionLabel?: string; onAction?: () => void; secondaryLabel?: string; onSecondary?: () => void; onDismiss?: () => void; size?: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  const tall = size === "lg";
  return /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      overflow: "hidden",
      borderRadius: "var(--radius-xl)",
      minHeight: tall ? 360 : 220,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      background: TONES[tone] || TONES.dusk,
      color: "#FBF8F2",
      isolation: "isolate",
      ...style
    }
  }, image ? /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: imageAlt,
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      zIndex: -2
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      zIndex: -1,
      backgroundImage: GRAIN,
      opacity: image ? 0.18 : 0.35,
      mixBlendMode: "overlay"
    }
  }), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      zIndex: -1,
      background: "linear-gradient(to top, rgba(18,16,14,.72) 0%, rgba(18,16,14,.25) 55%, rgba(18,16,14,0) 100%)"
    }
  }), onDismiss ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Dismiss",
    onClick: onDismiss,
    style: {
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
      color: "#FBF8F2",
      cursor: "pointer",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18,
    strokeWidth: 2
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: tall ? "24px 24px 24px" : "20px 20px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, kicker ? /*#__PURE__*/React.createElement("span", {
    style: {
      alignSelf: "flex-start",
      font: "600 var(--text-xs)/1 var(--font-body)",
      padding: "6px 10px",
      borderRadius: 99,
      background: "rgba(251,248,242,.18)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)"
    }
  }, kicker) : null, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: "700 " + (tall ? "34px" : "27px") + "/1.08 var(--font-display)",
      letterSpacing: "-0.02em",
      color: "inherit",
      margin: 0,
      textWrap: "balance"
    }
  }, title), body ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-body-sm)",
      fontSize: 15,
      color: "rgba(251,248,242,.9)",
      margin: 0,
      maxWidth: 420
    }
  }, body) : null, actionLabel || secondaryLabel ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      marginTop: 6
    }
  }, actionLabel ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    style: {
      height: 44,
      padding: "0 18px",
      border: 0,
      borderRadius: "var(--radius-pill)",
      background: "#FFFBF5",
      color: "#1D1914",
      font: "600 var(--text-base)/1 var(--font-body)",
      cursor: "pointer",
      transition: "transform var(--dur-fast) var(--ease-out), background var(--dur-fast)"
    },
    onPointerDown: e => e.currentTarget.style.transform = "scale(.97)",
    onPointerUp: e => e.currentTarget.style.transform = "",
    onPointerLeave: e => e.currentTarget.style.transform = ""
  }, actionLabel) : null, secondaryLabel ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onSecondary,
    style: {
      height: 44,
      padding: "0 14px",
      border: 0,
      borderRadius: "var(--radius-pill)",
      background: "transparent",
      color: "rgba(251,248,242,.92)",
      font: "600 var(--text-base)/1 var(--font-body)",
      cursor: "pointer",
      transition: "transform var(--dur-fast) var(--ease-out), background var(--dur-fast)"
    },
    onPointerEnter: e => e.currentTarget.style.background = "rgba(251,248,242,.14)",
    onPointerDown: e => e.currentTarget.style.transform = "scale(.97)",
    onPointerUp: e => e.currentTarget.style.transform = "",
    onPointerLeave: e => {
      e.currentTarget.style.transform = "";
      e.currentTarget.style.background = "transparent";
    }
  }, secondaryLabel) : null) : null, children));
}

export { SuggestionCard };
