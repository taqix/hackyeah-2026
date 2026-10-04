/* Hash routing. The site is served from a project path on GitHub Pages, so every route
   lives in the hash and the build works from any folder. */

export type ViewName = "landing" | "step" | "planning" | "plan" | "sample";

export interface Route {
  view: ViewName;
  /** The path the route came from, used to re-run per-route effects. */
  key: string;
  /** A section of the landing page to scroll to. */
  anchor?: string;
  /** Which question, for the step view. */
  step?: number;
}

export const FIRST_STEP = 1;
export const LAST_STEP = 4;

export const LANDING = "#/";
export const HOW_IT_WORKS = "#/how";
export const WHATS_INSIDE = "#/features";
export const PLANNING = "#/try/planning";
export const PLAN = "#/try/plan";
export const SAMPLE = "#/try/sample";

export function stepPath(step: number): string {
  return `#/try/${step}`;
}

/** Landing-page sections, which are routes so they can be linked and shared. */
const ANCHORS: Record<string, string> = {
  "/how": "how",
  "/features": "features",
};

const STEP_PATH = /^\/try\/([1-4])$/;

export function parseRoute(hash: string): Route {
  const path = (hash || "").replace(/^#/, "");
  const anchor = ANCHORS[path];
  if (anchor) return { view: "landing", anchor, key: path };
  const step = path.match(STEP_PATH);
  if (step) return { view: "step", step: Number(step[1]), key: path };
  if (path === "/try/planning") return { view: "planning", key: path };
  if (path === "/try/plan") return { view: "plan", key: path };
  if (path === "/try/sample") return { view: "sample", key: path };
  return { view: "landing", key: "/" };
}

/** Go somewhere, leaving a history entry. */
export function navigate(hash: string): void {
  location.hash = hash;
}

/** Go somewhere without adding history, for redirects and flows that must not be re-entered. */
export function redirect(hash: string): void {
  location.replace(hash);
}

/** Re-announce the current route, so clicking the link you are already on scrolls again. */
export function renavigate(): void {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
