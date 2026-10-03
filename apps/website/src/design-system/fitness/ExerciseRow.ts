// Ported from design/system/components.js (components/fitness/ExerciseRow.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";
import { ExerciseMedia } from "./ExerciseMedia";
import { Icon } from "../core/Icon";

function ExerciseRow({
  name,
  detail,
  meta,
  done = false,
  media,
  mediaSrc,
  mediaIcon,
  onToggle,
  onOpen,
  divider = true,
  style
}: { name: string; detail?: React.ReactNode; meta?: React.ReactNode; done?: boolean; media?: boolean; mediaSrc?: string; mediaIcon?: string; onToggle?: () => void; onOpen?: () => void; divider?: boolean; style?: React.CSSProperties }) {
  const showMedia = media || !!mediaSrc;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      minHeight: 72,
      padding: "12px 0",
      borderBottom: divider ? "1px solid var(--border-subtle)" : "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onOpen,
    role: onOpen ? "button" : undefined,
    tabIndex: onOpen ? 0 : undefined,
    onKeyDown: onOpen ? e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    } : undefined,
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 14,
      cursor: onOpen ? "pointer" : undefined
    }
  }, showMedia ? /*#__PURE__*/React.createElement(ExerciseMedia, {
    src: mediaSrc,
    alt: name,
    icon: mediaIcon,
    size: 52,
    style: {
      opacity: done ? 0.5 : 1,
      transition: "opacity var(--dur-base)"
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "600 var(--text-base)/1.3 var(--font-body)",
      color: done ? "var(--text-tertiary)" : "var(--text-primary)",
      transition: "color var(--dur-base)"
    }
  }, name), detail || meta ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body-sm)",
      fontVariantNumeric: "tabular-nums",
      color: "var(--text-secondary)"
    }
  }, detail, detail && meta ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-tertiary)"
    }
  }, " \xB7 ", meta) : meta) : null)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": done ? "Mark not done" : "Mark done",
    "aria-pressed": done,
    onClick: onToggle,
    style: {
      width: 44,
      height: 44,
      marginRight: -8,
      flex: "none",
      border: 0,
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 99,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: done ? "var(--accent)" : "transparent",
      border: "1.5px solid " + (done ? "var(--accent)" : "var(--border-strong)"),
      color: "var(--text-on-accent)",
      transform: done ? "scale(1)" : "scale(.96)",
      transition: "all var(--dur-slow) var(--ease-spring)"
    }
  }, done ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15,
    strokeWidth: 2.5
  }) : null)));
}

export { ExerciseRow };
