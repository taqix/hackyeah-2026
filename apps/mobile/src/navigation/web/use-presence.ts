import { useEffect, useState } from 'react';

export type Presence = {
  /** Render it: true while open and until the exit transition has had its time. */
  shown: boolean;
  /** Its open look: set a frame after it shows, so the enter transition has a start to run from. */
  entered: boolean;
};

/** Keeps a panel on screen while it eases in and out with a CSS transition of `exitMs`. */
export function usePresence(open: boolean, exitMs: number): Presence {
  const [shown, setShown] = useState(open);
  const [entered, setEntered] = useState(open);
  if (open && !shown) setShown(true);
  if (!open && entered) setEntered(false);

  useEffect(() => {
    if (open) {
      // Two frames: the closed look paints first, then the open one transitions in.
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(() => setShown(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);

  return { shown, entered };
}
