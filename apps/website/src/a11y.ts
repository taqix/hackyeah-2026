/* Accessibility helpers shared by the components. */

/** Hide a decorative subtree from assistive tech and keyboard focus, as a ref callback. */
export function setInert(element: HTMLElement | null): void {
  element?.setAttribute("inert", "");
}
