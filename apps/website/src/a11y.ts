/* Keyboard and screen-reader helpers shared by the views. */

import type { KeyboardEvent } from "react";

const ARROW_STEPS: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

/** Which way an arrow key moves, or null for any other key. */
export function arrowStep(key: string): number | null {
  return ARROW_STEPS[key] ?? null;
}

/** The next index in a list that wraps at both ends. */
export function wrapIndex(index: number, step: number, length: number): number {
  return (index + step + length) % length;
}

/** Arrow keys move focus and selection between the [role=radio] items of a group, wrapping.
    For groups whose items own their state; a group driven by React state uses `arrowStep`. */
export function handleRadioArrows(event: KeyboardEvent<HTMLElement>): void {
  const step = arrowStep(event.key);
  if (step === null) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const current = items.indexOf(document.activeElement as HTMLElement);
  if (current < 0) return;
  event.preventDefault();
  const next = items[wrapIndex(current, step, items.length)];
  next.focus();
  next.click();
}

/** Hide a decorative subtree from assistive tech and keyboard focus, as a ref callback. */
export function setInert(element: HTMLElement | null): void {
  element?.setAttribute("inert", "");
}
