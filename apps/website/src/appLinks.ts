/* Links into the Movo app. Its web build is served from app/ beside this site
   (https://taqix.github.io/hackyeah-2026/app/), so the default is relative and works under
   any base path. VITE_APP_URL points the links at another server, such as a local Expo
   dev server. */

function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

const APP_URL = withTrailingSlash(import.meta.env.VITE_APP_URL || "./app/");

/** Creates a guest and starts onboarding: the whole app, with no account. */
export const GUEST_ENTRY = `${APP_URL}guest`;

/** Signs in to an account, or creates one. */
export const SIGN_IN = `${APP_URL}welcome`;
