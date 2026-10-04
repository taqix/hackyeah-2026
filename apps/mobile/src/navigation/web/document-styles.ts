import { colors } from '@/theme/tokens';

/*
 * The page-level look of the web app, shared by the static HTML document
 * (app/+html.tsx: static rendering and the dev server) and DocumentHead, which
 * adds the same style sheet and icon when the page came from Expo's plain SPA
 * template (the GitHub Pages export), where +html.tsx never runs.
 */

const { light, dark } = colors;

/** Movo's mark (design/icons.html, "Monitor"), the icon apps/website uses. */
export const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='27' fill='%231D1914'/><linearGradient id='g' gradientUnits='userSpaceOnUse' x1='8' x2='92' y1='0' y2='0'><stop offset='0' stop-color='%2386AEE3' stop-opacity='0'/><stop offset='.55' stop-color='%2386AEE3'/></linearGradient><path d='M8 70H24L36 38L54 76L72 38L84 70H92' fill='none' stroke='url(%23g)' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/><circle cx='102' cy='70' r='16' fill='%23FFFBF5' opacity='.22'/><circle cx='102' cy='70' r='8.5' fill='%23FFFBF5'/></svg>";

/** Page-wide CSS the components can't set: the canvas, scrollbars, selection, cursors and the default focus ring. */
export const GLOBAL_CSS = `
:root { color-scheme: light dark; -webkit-tap-highlight-color: transparent; }
html, body { background-color: var(--movo-bg, ${light.bgApp}); }
body { overscroll-behavior: none; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
::selection { background-color: var(--movo-selection, rgba(62,116,196,0.26)); }
* { scrollbar-width: thin; scrollbar-color: var(--movo-scrollbar, ${light.borderStrong}) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background-color: var(--movo-scrollbar, ${light.borderStrong}); border: 3px solid transparent; border-radius: 999px; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background-color: var(--movo-scrollbar-hover, ${light.textTertiary}); }
@media (prefers-color-scheme: dark) {
  html, body { background-color: var(--movo-bg, ${dark.bgApp}); }
  * { scrollbar-color: var(--movo-scrollbar, ${dark.borderStrong}) transparent; }
  ::-webkit-scrollbar-thumb { background-color: var(--movo-scrollbar, ${dark.borderStrong}); }
}
[role="tab"], [role="link"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"], [role="menuitem"] { cursor: pointer; }
:focus-visible:not(input):not(textarea) { outline: 3px solid var(--movo-focus, ${light.focusRing}); outline-offset: 2px; }
#movo-coach-dock-resize { cursor: col-resize; }
#movo-coach-dock-resize > div { opacity: 0; transition: opacity 120ms ease-out; }
#movo-coach-dock-resize:hover > div, #movo-coach-dock-resize:active > div { opacity: 1; }
`;
