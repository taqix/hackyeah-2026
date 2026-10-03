// Ported from design/system/components.js (components/core/useInteraction.js).
// Hover and press state for the design system's controls, as pointer handlers to spread
// onto an element. A disabled control binds nothing, so it never looks interactive.
import { useState, type HTMLAttributes } from "react";

export interface Interaction {
  hover: boolean;
  pressed: boolean;
  bind: HTMLAttributes<HTMLElement>;
}

export function useInteraction(disabled: boolean): Interaction {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const bind: HTMLAttributes<HTMLElement> = disabled
    ? {}
    : {
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => {
          setHover(false);
          setPressed(false);
        },
        onPointerDown: () => setPressed(true),
        onPointerUp: () => setPressed(false),
        onPointerCancel: () => setPressed(false),
      };
  return { hover, pressed, bind };
}
