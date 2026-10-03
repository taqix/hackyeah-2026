// Ported from design/system/components.js (components/core/Icon.jsx): same output, with prop types and object spread in place of Babel helpers.
import React from "react";
import * as lucide from "lucide";

const toPascal = n => String(n).split(/[-_ ]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
const toCamel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
/** Lucide glyph renderer: looks the glyph up by name in the bundled lucide package. */
function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  color = "currentColor",
  title,
  style
}: { name: string; size?: number; strokeWidth?: number; color?: string; title?: string; style?: React.CSSProperties }) {
  const lib = lucide;
  const key = toPascal(name);
  let node = lib && (lib.icons && lib.icons[key] || lib[key]);
  if (Array.isArray(node) && node[0] === "svg") node = node[2];
  const kids = Array.isArray(node) ? node.map(([tag, attrs], i) => {
    const a = {
      key: i
    };
    for (const k in attrs) a[toCamel(k)] = attrs[k];
    return React.createElement(tag, a);
  }) : null;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    role: title ? "img" : undefined,
    "aria-hidden": title ? undefined : true,
    style: {
      flex: "none",
      display: "block",
      ...style
    }
  }, title ? /*#__PURE__*/React.createElement("title", null, title) : null, kids);
}

export { Icon };
