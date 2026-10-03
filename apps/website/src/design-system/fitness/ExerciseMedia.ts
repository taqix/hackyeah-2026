// Ported from design/system/components.js (components/fitness/ExerciseMedia.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";
import { Icon } from "../core/Icon";

/** Exercise image / GIF slot. Shows the provided src (static image or animated GIF); falls back to a quiet placeholder. */
function ExerciseMedia({
  src,
  alt = "",
  shape = "circle",
  size = 52,
  ratio = "1 / 1",
  playing = true,
  label,
  icon,
  style
}: { src?: string; alt?: string; shape?: string; size?: number; ratio?: string; playing?: boolean; label?: string; icon?: string; style?: React.CSSProperties }) {
  const circle = shape === "circle";
  const box = circle ? {
    width: size,
    height: size,
    borderRadius: "var(--radius-pill)",
    flex: "none"
  } : {
    width: "100%",
    aspectRatio: ratio,
    borderRadius: "var(--radius-card)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...box,
      position: "relative",
      overflow: "hidden",
      background: "var(--surface-sunken)",
      boxShadow: "inset 0 0 0 1px var(--border-subtle)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      color: "var(--text-tertiary)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon || (circle ? "dumbbell" : "film"),
    size: circle ? Math.round(size * 0.4) : 28,
    strokeWidth: 1.5
  }), !circle ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-caption)"
    }
  }, label || "Exercise animation") : null), !circle && src ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 12,
      bottom: 12,
      height: 28,
      padding: "0 10px",
      display: "flex",
      alignItems: "center",
      gap: 6,
      borderRadius: 99,
      background: "color-mix(in oklch, var(--surface-inverse) 72%, transparent)",
      color: "var(--text-inverse)",
      font: "var(--type-caption)",
      backdropFilter: "blur(8px)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: playing ? "repeat" : "pause",
    size: 12
  }), playing ? "Looping" : "Paused") : null);
}

export { ExerciseMedia };
