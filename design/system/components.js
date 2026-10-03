/* Design system components (Babel-compiled JSX). Registers window.DS.
   Requires React 18 UMD and Lucide UMD (window.lucide) on the page. */
(() => {

const __ds_ns = (window.DS = window.DS || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const TONES = {
  neutral: ["var(--surface-sunken)", "var(--text-secondary)"],
  accent: ["var(--accent-soft-strong)", "var(--accent-text)"],
  recovery: ["var(--recovery-soft)", "var(--text-secondary)"],
  success: ["var(--success-soft)", "var(--success)"],
  danger: ["var(--danger-soft)", "var(--danger)"],
  info: ["var(--info-soft)", "var(--info)"]
};
function Badge({
  tone = "neutral",
  dot = false,
  children,
  style
}) {
  const [bg, fg] = TONES[tone] || TONES.neutral;
  const dotColor = tone === "recovery" ? "var(--recovery)" : fg;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 24,
      padding: "0 10px",
      borderRadius: "var(--radius-pill)",
      background: bg,
      color: fg,
      font: "var(--type-caption)",
      whiteSpace: "nowrap",
      ...style
    }
  }, dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 99,
      background: dotColor
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
const toPascal = n => String(n).split(/[-_ ]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
const toCamel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
/** Lucide glyph renderer. Requires the Lucide UMD script on the page (window.lucide). */
function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  color = "currentColor",
  title,
  style
}) {
  const lib = typeof window !== "undefined" ? window.lucide : null;
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
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/useInteraction.js
try { (() => {
function useInteraction(disabled) {
  const [hover, setHover] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const bind = disabled ? {} : {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPressed(false);
    },
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false)
  };
  return {
    hover,
    pressed,
    bind
  };
}
Object.assign(__ds_scope, { useInteraction });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/useInteraction.js", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    h: 36,
    px: 14,
    f: "var(--text-sm)",
    ic: 16,
    gap: 6
  },
  md: {
    h: 48,
    px: 20,
    f: "var(--text-base)",
    ic: 18,
    gap: 8
  },
  lg: {
    h: 56,
    px: 26,
    f: "var(--text-md)",
    ic: 20,
    gap: 10
  }
};
function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  fullWidth = false,
  disabled = false,
  type = "button",
  onClick,
  children,
  style
}) {
  const {
    hover,
    pressed,
    bind
  } = __ds_scope.useInteraction(disabled);
  const s = SIZES[size] || SIZES.md;
  const v = {
    primary: {
      bg: pressed ? "var(--accent-pressed)" : hover ? "var(--accent-hover)" : "var(--accent)",
      fg: "var(--text-on-accent)",
      bd: "transparent"
    },
    secondary: {
      bg: hover ? "var(--surface-sunken)" : "var(--surface-card)",
      fg: "var(--text-primary)",
      bd: "var(--border-strong)"
    },
    ghost: {
      bg: hover ? "var(--surface-sunken)" : "transparent",
      fg: "var(--text-primary)",
      bd: "transparent"
    },
    inverse: {
      bg: "var(--surface-inverse)",
      fg: "var(--text-inverse)",
      bd: "transparent",
      op: hover ? 0.88 : 1
    }
  }[variant] || {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: disabled ? undefined : onClick
  }, bind, {
    style: {
      display: fullWidth ? "flex" : "inline-flex",
      width: fullWidth ? "100%" : undefined,
      alignItems: "center",
      justifyContent: "center",
      gap: s.gap,
      height: s.h,
      padding: "0 " + s.px + "px",
      borderRadius: "var(--radius-pill)",
      border: "1px solid " + v.bd,
      background: v.bg,
      color: v.fg,
      font: "600 " + s.f + "/1 var(--font-body)",
      letterSpacing: "-0.005em",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : v.op ?? 1,
      transform: pressed ? "scale(var(--press-scale))" : "none",
      transition: "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)",
      whiteSpace: "nowrap",
      ...style
    }
  }), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.ic
  }) : null, children, iconRight ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.ic
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const V = {
  default: {
    background: "var(--surface-card)",
    border: "1px solid var(--border-subtle)",
    boxShadow: "var(--shadow-card)"
  },
  sunken: {
    background: "var(--surface-sunken)",
    border: "1px solid transparent",
    boxShadow: "none"
  },
  accent: {
    background: "var(--accent-soft)",
    border: "1px solid transparent",
    boxShadow: "none"
  },
  outline: {
    background: "transparent",
    border: "1px solid var(--border-strong)",
    boxShadow: "none"
  }
};
function Card({
  variant = "default",
  padding = 20,
  onClick,
  children,
  style
}) {
  const interactive = !!onClick;
  const {
    pressed,
    bind
  } = __ds_scope.useInteraction(!interactive);
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    role: interactive ? "button" : undefined,
    tabIndex: interactive ? 0 : undefined
  }, bind, {
    style: {
      ...(V[variant] || V.default),
      borderRadius: "var(--radius-card)",
      padding,
      cursor: interactive ? "pointer" : undefined,
      transform: pressed ? "scale(0.99)" : "none",
      transition: "transform var(--dur-base) var(--ease-out)",
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  disabled = false,
  onClick,
  style
}) {
  const {
    hover,
    pressed,
    bind
  } = __ds_scope.useInteraction(disabled);
  const d = size === "sm" ? 36 : 44;
  const v = {
    ghost: {
      bg: hover ? "var(--surface-sunken)" : "transparent",
      fg: "var(--text-primary)",
      bd: "transparent"
    },
    secondary: {
      bg: hover ? "var(--surface-sunken)" : "var(--surface-card)",
      fg: "var(--text-primary)",
      bd: "var(--border-strong)"
    },
    primary: {
      bg: pressed ? "var(--accent-pressed)" : hover ? "var(--accent-hover)" : "var(--accent)",
      fg: "var(--text-on-accent)",
      bd: "transparent"
    }
  }[variant] || {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: disabled ? undefined : onClick
  }, bind, {
    style: {
      width: d,
      height: d,
      flex: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-pill)",
      border: "1px solid " + v.bd,
      background: v.bg,
      color: v.fg,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      padding: 0,
      transform: pressed ? "scale(var(--press-scale))" : "none",
      transition: "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
      ...style
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === "sm" ? 18 : 20
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tag({
  selected = false,
  icon,
  disabled = false,
  onClick,
  children,
  style
}) {
  const {
    hover,
    pressed,
    bind
  } = __ds_scope.useInteraction(disabled);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-pressed": selected,
    disabled: disabled,
    onClick: disabled ? undefined : onClick
  }, bind, {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 40,
      padding: "0 16px",
      borderRadius: "var(--radius-pill)",
      border: "1px solid " + (selected ? "var(--surface-inverse)" : "var(--border-strong)"),
      background: selected ? "var(--surface-inverse)" : hover ? "var(--surface-sunken)" : "var(--surface-card)",
      color: selected ? "var(--text-inverse)" : "var(--text-primary)",
      font: "var(--type-label)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transform: pressed ? "scale(var(--press-scale))" : "none",
      transition: "all var(--dur-fast) var(--ease-out)",
      ...style
    }
  }), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }) : null, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/fitness/ExerciseMedia.jsx
try { (() => {
/** Exercise image / GIF slot. Shows the provided src (static image or animated GIF); falls back to a quiet placeholder. */
function ExerciseMedia({
  src,
  alt = "",
  shape = "circle",
  size = 52,
  ratio = "1 / 1",
  playing = true,
  label,
  style
}) {
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
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: circle ? "dumbbell" : "film",
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
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: playing ? "repeat" : "pause",
    size: 12
  }), playing ? "Looping" : "Paused") : null);
}
Object.assign(__ds_scope, { ExerciseMedia });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/fitness/ExerciseMedia.jsx", error: String((e && e.message) || e) }); }

// components/fitness/ExerciseRow.jsx
try { (() => {
function ExerciseRow({
  name,
  detail,
  meta,
  done = false,
  media,
  mediaSrc,
  onToggle,
  onOpen,
  divider = true,
  style
}) {
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
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 14,
      cursor: onOpen ? "pointer" : undefined
    }
  }, showMedia ? /*#__PURE__*/React.createElement(__ds_scope.ExerciseMedia, {
    src: mediaSrc,
    alt: name,
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
  }, done ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 15,
    strokeWidth: 2.5
  }) : null)));
}
Object.assign(__ds_scope, { ExerciseRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/fitness/ExerciseRow.jsx", error: String((e && e.message) || e) }); }

// components/fitness/ProgressRing.jsx
try { (() => {
function ProgressRing({
  value = 0,
  size = 56,
  stroke = 5,
  label,
  children,
  style
}) {
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
Object.assign(__ds_scope, { ProgressRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/fitness/ProgressRing.jsx", error: String((e && e.message) || e) }); }

// components/fitness/SuggestionCard.jsx
try { (() => {
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
}) {
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
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
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
Object.assign(__ds_scope, { SuggestionCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/fitness/SuggestionCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  value,
  defaultValue,
  placeholder,
  hint,
  error,
  suffix,
  type = "text",
  inputMode,
  disabled = false,
  onChange,
  style
}) {
  const [focus, setFocus] = React.useState(false);
  const id = React.useId();
  const bd = error ? "var(--danger)" : focus ? "var(--accent)" : "var(--border-strong)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      font: "var(--type-label)",
      color: "var(--text-secondary)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      height: 52,
      padding: "0 16px",
      gap: 8,
      borderRadius: "var(--radius-control)",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
      border: "1px solid " + bd,
      boxShadow: focus ? "0 0 0 4px var(--focus-ring)" : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
      opacity: disabled ? 0.6 : 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: id,
    type: type,
    inputMode: inputMode,
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value, e),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 0,
      outline: "none",
      background: "transparent",
      color: "var(--text-primary)",
      font: "var(--type-body)",
      padding: 0
    }
  }), suffix ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--text-tertiary)"
    }
  }, suffix) : null), error || hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-caption)",
      color: error ? "var(--danger)" : "var(--text-tertiary)"
    }
  }, error || hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function useHP(disabled) {
  const [h, setH] = React.useState(false);
  const [p, setP] = React.useState(false);
  return [h, p, disabled ? {} : {
    onMouseEnter: () => setH(true),
    onMouseLeave: () => {
      setH(false);
      setP(false);
    },
    onPointerDown: () => setP(true),
    onPointerUp: () => setP(false)
  }];
}
function Choice({
  variant,
  checked,
  label,
  description,
  disabled,
  onClick,
  indicator,
  style
}) {
  const [hover, pressed, bind] = useHP(disabled);
  const card = variant === "card";
  const key = e => {
    if (!disabled && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      onClick && onClick();
    }
  };
  const text = label || description ? /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: (card ? "600 " : "500 ") + "var(--text-base)/1.3 var(--font-body)",
      color: "var(--text-primary)"
    }
  }, label) : null, description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body-sm)",
      color: "var(--text-tertiary)"
    }
  }, description) : null) : null;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "radio",
    "aria-checked": checked,
    "aria-disabled": disabled || undefined,
    tabIndex: disabled ? -1 : 0,
    onClick: disabled ? undefined : onClick,
    onKeyDown: key
  }, bind, {
    style: {
      display: "flex",
      alignItems: description ? "flex-start" : "center",
      gap: 14,
      minHeight: card ? 60 : 48,
      padding: card ? "14px 16px" : "10px 0",
      borderRadius: card ? "var(--radius-md)" : 0,
      background: card ? checked ? "var(--accent-soft)" : hover ? "var(--surface-sunken)" : "var(--surface-card)" : "transparent",
      boxShadow: card ? checked ? "inset 0 0 0 1.5px var(--accent)" : "inset 0 0 0 1px var(--border-strong)" : "none",
      transform: pressed ? "scale(0.985)" : "none",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      outline: "none",
      transition: "background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
      ...style
    }
  }), card ? null : indicator(hover), text, card ? indicator(hover) : null);
}
function Radio({
  checked = false,
  label,
  description,
  variant = "row",
  disabled = false,
  onChange,
  style
}) {
  const ind = hover => /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      flex: "none",
      borderRadius: 99,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      marginTop: description ? 0 : undefined,
      background: "var(--surface-card)",
      border: checked ? "2px solid var(--accent)" : "1.5px solid " + (hover ? "var(--text-tertiary)" : "var(--border-strong)"),
      boxShadow: checked ? "0 0 0 4px var(--accent-soft-strong)" : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 99,
      background: "var(--accent)",
      transform: checked ? "scale(1)" : "scale(0)",
      transition: "transform var(--dur-slow) var(--ease-spring)"
    }
  }));
  return /*#__PURE__*/React.createElement(Choice, {
    variant: variant,
    checked: checked,
    label: label,
    description: description,
    disabled: disabled,
    onClick: () => onChange && onChange(true),
    indicator: ind,
    style: style
  });
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.ExerciseMedia = __ds_scope.ExerciseMedia;

__ds_ns.ExerciseRow = __ds_scope.ExerciseRow;

__ds_ns.ProgressRing = __ds_scope.ProgressRing;

__ds_ns.SuggestionCard = __ds_scope.SuggestionCard;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

})();
