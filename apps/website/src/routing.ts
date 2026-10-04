/* Hash routing. The site is served from a project path on GitHub Pages, so every route
   lives in the hash and the build works from any folder. */

/** The landing page, or an old link into the demo this site used to host, which now goes
    to the app's guest entry. */
export type ViewName = "landing" | "guest";

export interface Route {
  view: ViewName;
  /** The path the route came from, used to re-run per-route effects. */
  key: string;
  /** A section of the landing page to scroll to. */
  anchor?: string;
}

export const LANDING = "#/";
export const HOW_IT_WORKS = "#/how";
export const WHATS_INSIDE = "#/features";

/** Landing-page sections, which are routes so they can be linked and shared. */
const ANCHORS: Record<string, string> = {
  "/how": "how",
  "/features": "features",
};

/** The old demo's paths: #/try/1 to #/try/4, #/try/planning, #/try/plan and #/try/sample. */
const DEMO_PATH = /^\/try(\/|$)/;

export function parseRoute(hash: string): Route {
  const path = (hash || "").replace(/^#/, "");
  const anchor = ANCHORS[path];
  if (anchor) return { view: "landing", anchor, key: path };
  if (DEMO_PATH.test(path)) return { view: "guest", key: path };
  return { view: "landing", key: "/" };
}

/** Leave for another address without adding history, so Back skips the link that redirected. */
export function redirect(url: string): void {
  location.replace(url);
}

/** Re-announce the current route, so clicking the link you are already on scrolls again. */
export function renavigate(): void {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
