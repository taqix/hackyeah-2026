import { Icon } from "../../design-system";
import type { ReactNode } from "react";

/** A quiet note with an icon, for a reassurance such as "Plan unchanged". */
export function Fine({ icon, children, tone }: { icon?: string; children?: ReactNode; tone?: string }) {
  return (
    <span className="s-fine">
      {icon ? <Icon name={icon} size={16} style={tone ? { color: tone } : undefined} /> : null}
      <span>{children}</span>
    </span>
  );
}
