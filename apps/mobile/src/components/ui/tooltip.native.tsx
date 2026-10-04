import type { TooltipProps } from './tooltip';

/** Phones have no hover: the control alone, which already carries its label. See tooltip.tsx for the web. */
export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}
