/* Media queries as React state, and the breakpoint the layout switches on. */

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const sync = () => setMatches(list.matches);
    list.addEventListener("change", sync);
    sync();
    return () => list.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

export type Breakpoint = "phone" | "tablet" | "desktop";

const DESKTOP_QUERY = "(min-width: 1024px)";
const TABLET_QUERY = "(min-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Which layout to show. The phone layout is the default, not a fallback. */
export function useBreakpoint(): Breakpoint {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const tablet = useMediaQuery(TABLET_QUERY);
  return desktop ? "desktop" : tablet ? "tablet" : "phone";
}

/** Whether the reader has asked for less motion, for scroll behaviour. */
export function prefersReducedMotion(): boolean {
  return matchMedia(REDUCED_MOTION_QUERY).matches;
}
