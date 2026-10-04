/**
 * The web address of an app route: the page's origin, then the router's base
 * URL when the app is served under one (GitHub Pages serves it at
 * `/hackyeah-2026/app`), then the route. expo-linking's `createURL` drops the
 * base URL on the web, so Auth links built with it (Google's return, the
 * confirmation and reset emails) would land outside the app.
 */
export function webAppUrl(origin: string, path: string, baseUrl = ''): string {
  const parts = [origin.replace(/\/+$/, ''), baseUrl.trim().replace(/^\/+|\/+$/g, ''), path.replace(/^\/+/, '')];
  return parts.filter(Boolean).join('/');
}
