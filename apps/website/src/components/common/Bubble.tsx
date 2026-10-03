import type { ReactNode } from "react";

/** A chat bubble: the coach's by default, the reader's own with `me`. */
export function Bubble({ me, children }: { me?: boolean; children?: ReactNode }) {
  return <div className={`s-bubble${me ? " is-me" : ""}`}>{children}</div>;
}
