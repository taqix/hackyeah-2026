// Ported from design/system/components.js (components/core/useInteraction.js): same output, with prop types and object spread in place of Babel helpers.
import React from "react";

function useInteraction(disabled: boolean): { hover: boolean; pressed: boolean; bind: React.HTMLAttributes<HTMLElement> } {
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

export { useInteraction };
