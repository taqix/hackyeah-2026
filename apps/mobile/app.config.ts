import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json, plus a sub-path web export when EXPO_WEB_BASE_URL is set (the GitHub
 * Pages build sets /hackyeah-2026/app). That export is a single-page app: a static
 * host can't serve the static renderer's per-route pages for dynamic routes such as
 * /session/<id>, so every route loads one index.html and the router reads the URL.
 * `expo start` and native builds leave it unset and get app.json unchanged.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const expo = config as ExpoConfig;
  const path = process.env.EXPO_WEB_BASE_URL?.trim().replace(/^\/+|\/+$/g, '');
  if (!path) return expo;

  return {
    ...expo,
    web: { ...expo.web, output: 'single' },
    experiments: { ...expo.experiments, baseUrl: `/${path}` },
  };
};
