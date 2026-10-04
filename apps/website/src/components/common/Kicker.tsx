import type { CSSProperties, ReactNode } from "react";

/** The small line above a heading. */
export function Kicker({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <span className="s-kicker" style={style}>{children}</span>;
}
