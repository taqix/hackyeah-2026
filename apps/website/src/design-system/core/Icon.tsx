// Ported from design/system/components.js (components/core/Icon.jsx).
// Renders a Lucide glyph by name. The whole icon map is bundled because names are
// resolved at runtime, so look-ups are cached per name.
import * as lucide from "lucide";
import type { CSSProperties } from "react";

/** A glyph's shape: an SVG child tag and its attributes, as Lucide stores them. */
type GlyphChild = [string, Record<string, string>];

const glyphCache = new Map<string, GlyphChild[] | null>();

function pascalCase(name: string): string {
  return name
    .split(/[-_ ]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function camelCase(attribute: string): string {
  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Lucide exports glyphs both under `icons` and as named members, and either as the
    children alone or as a whole `["svg", attrs, children]` node. */
function lookUpGlyph(name: string): GlyphChild[] | null {
  const library = lucide as unknown as { icons?: Record<string, unknown> } & Record<string, unknown>;
  const key = pascalCase(name);
  let node: unknown = library.icons?.[key] ?? library[key];
  if (Array.isArray(node) && node[0] === "svg") node = node[2];
  return Array.isArray(node) ? (node as GlyphChild[]) : null;
}

function glyphChildren(name: string): GlyphChild[] | null {
  const cached = glyphCache.get(name);
  if (cached !== undefined) return cached;
  const children = lookUpGlyph(name);
  glyphCache.set(name, children);
  return children;
}

export interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Give an icon a title only when it carries meaning on its own; otherwise it is hidden. */
  title?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 20, strokeWidth = 1.75, color = "currentColor", title, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      style={{ flex: "none", display: "block", ...style }}
    >
      {title ? <title>{title}</title> : null}
      {glyphChildren(name)?.map(([tag, attributes], index) => {
        const Shape = tag as "circle";
        const props: Record<string, string> = {};
        for (const attribute in attributes) props[camelCase(attribute)] = attributes[attribute];
        return <Shape key={index} {...props} />;
      })}
    </svg>
  );
}
