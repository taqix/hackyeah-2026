/* On every route: scroll where the reader expects, move focus to the new heading, and
   name the page. Focus only moves after the first render, so arriving does not steal it. */

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./useMediaQuery";
import type { Route } from "../routing";

/** The heading of the page currently shown; each view marks exactly one. */
const PAGE_HEADING = "main h1[data-page-title]";

/** Clearance for the sticky top bar, plus a little air above the heading. */
const STICKY_HEADER = 64;
const HEADING_AIR = 32;

const SITE_TITLE = "Movo · Everyone starts somewhere";
const DEMO_TITLE = "Movo demo";

function scrollBehaviour(immediately: boolean): ScrollBehavior {
  return prefersReducedMotion() || immediately ? "auto" : "smooth";
}

function scrollToSection(anchor: string, isFirstRender: boolean): void {
  const section = document.getElementById(anchor);
  if (!section) return;
  /* Stop at the section's heading block, not the padded edge above it. */
  const top = section.querySelector(".s-sechead") ?? section;
  window.scrollTo({
    top: top.getBoundingClientRect().top + window.scrollY - STICKY_HEADER - HEADING_AIR,
    behavior: scrollBehaviour(isFirstRender),
  });
  const heading = section.querySelector<HTMLElement>("h2");
  if (heading && !isFirstRender) heading.focus({ preventScroll: true });
}

function scrollToTop(isFirstRender: boolean): void {
  window.scrollTo(0, 0);
  const heading = document.querySelector<HTMLElement>(PAGE_HEADING);
  if (heading && !isFirstRender) heading.focus({ preventScroll: true });
}

function documentTitle(route: Route): string {
  if (route.view === "landing") return SITE_TITLE;
  const heading = document.querySelector(PAGE_HEADING);
  return heading?.textContent ? `${heading.textContent} · ${DEMO_TITLE}` : DEMO_TITLE;
}

export interface RouteFocusInput {
  route: Route;
  navigationId: number;
  /** False while a redirect is pending, when the view on screen is about to be replaced. */
  active: boolean;
}

export function useRouteFocus({ route, navigationId, active }: RouteFocusInput): void {
  const firstRender = useRef(true);
  useEffect(() => {
    if (!active) return;
    const isFirstRender = firstRender.current;
    firstRender.current = false;
    /* Wait for the new view to be laid out before measuring or focusing it. */
    const frame = requestAnimationFrame(() => {
      if (route.anchor) scrollToSection(route.anchor, isFirstRender);
      else scrollToTop(isFirstRender);
      document.title = documentTitle(route);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.key, navigationId, active]);
}

/** Back to the top of the page, and to its heading, from the footer. */
export function scrollToPageTop(): void {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  document.querySelector<HTMLElement>(PAGE_HEADING)?.focus({ preventScroll: true });
}
