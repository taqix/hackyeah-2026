import type { ReactNode } from "react";

export interface TagGroupProps {
  id: string;
  label: string;
  caption?: string;
  children?: ReactNode;
}

/** A labelled group of selectable tags, e.g. "Where could you move?". */
export function TagGroup({ id, label, caption, children }: TagGroupProps) {
  return (
    <div className="s-group" role="group" aria-labelledby={id}>
      <div className="s-grouphead">
        <h2 id={id} className="s-sect">{label}</h2>
        {caption ? <span className="s-cap" style={{ flex: "none" }}>{caption}</span> : null}
      </div>
      <div className="s-tags">{children}</div>
    </div>
  );
}
