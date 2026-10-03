// Ported from design/system/components.js (components/fitness/ProgressRing.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";

function ProgressRing({
  value = 0,
  size = 56,
  stroke = 5,
  label,
  children,
  style
}: { value?: number; size?: number; stroke?: number; label?: React.ReactNode; children?: React.ReactNode; style?: React.CSSProperties }) {
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    v = Math.max(0, Math.min(1, value));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size,
      flex: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      transform: "rotate(-90deg)",
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--border-subtle)",
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - v),
    style: {
      transition: "stroke-dashoffset var(--dur-calm) var(--ease-out)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      font: "600 " + Math.round(size * 0.26) + "px/1 var(--font-numeric)",
      color: "var(--text-primary)"
    }
  }, children ?? label));
}

export { ProgressRing };
