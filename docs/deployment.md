# Runtime status

## Supabase product API

The hosted Supabase project (FitnessApp) runs the
[product API](features/supabase-product-api.md), and the mobile app uses it by
default; see [Mobile app on Supabase](features/mobile-supabase-integration.md).

Live state after the 4 October 2026 push:

- **Migrations:**
  - Applied up to `20261004120000_profile_username_from_auth`, including
    `20261004100000_feedback_opinions_undo` and
    `20261004110000_sport_catalog_seed`. The username migration makes signup
    copy the Auth name into `profile.username` and backfills existing profiles.
  - The wearable migration `20261003120000` is intentionally not applied.
  - The catalog has 7 working sports and 15 previews.
- **Function:** `product-api` is redeployed with `verify_jwt = true`. It
  includes the Gemini adapter, late feedback, opinions, Undo, and Google token
  refresh (`POST /google/token`).
- **Secrets:** `GEMINI_API_KEY` and `GEMINI_MODEL` are set.
- **Auth:**
  - The Google provider is on, and manual identity linking is on.
  - Anonymous sign-ins are on (4 October 2026), for the web app's guest entry.
  - Redirects are allowlisted for `hackyeah2026://auth/{callback,reset}`,
    `exp://**/--/auth/{callback,reset}`,
    `http://localhost:8081/auth/{callback,reset}` and, since 4 October 2026,
    the [web app](#github-pages-landing-page-and-web-app)'s
    `https://taqix.github.io/hackyeah-2026/app/auth/{callback,reset}`.
  - Auth refuses redirects to a raw IP host, even allowlisted ones, and falls
    back to the Site URL (`http://localhost:3000`). Expo Go needs a hostname:
    `npm run start:hostname`, `--tunnel`, or the development build.

Remaining owner steps:

1. **Google token refresh:** set the same Web client the Supabase Google
   provider uses:
   `supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<ID> GOOGLE_OAUTH_CLIENT_SECRET=<SECRET>`.
   The Management API exposes only a digest of the secret, so it cannot be
   copied from Auth settings. Without it, Google Calendar asks the person to
   reconnect when the access token expires (about an hour).
2. **Google Cloud:** enable the Google Calendar API. Add the
   `calendar.freebusy` and `calendar.app.created` scopes and the test users to
   the consent screen.
3. **Gateway JWT check:** if the gateway ever rejects valid user tokens (the
   project signs them with ES256), decide whether to deploy with
   `--no-verify-jwt`. The handler verifies every token with Auth itself.
4. **Optional:** enable leaked-password protection in Auth.
5. **Optional:** set the Auth Site URL to
   `https://taqix.github.io/hackyeah-2026/app/`, so a redirect Auth refuses
   lands on the web app instead of `http://localhost:3000`.
6. **Smoke test** from the app:
   - a new account through onboarding to its first plan
   - a log with feedback
   - a chat change and its Undo
   - Google sign-in and Google Calendar connect
   - a second account that sees none of the first account's data

Deploy commands (Supabase CLI, no Docker needed):
`supabase functions deploy product-api --project-ref <REF> --use-api` and
`supabase secrets set --env-file <file-with-only-the-new-secrets>`.

## Backend (NestJS)

The NestJS backend is local only. There is no cloud infrastructure, registry,
or hosted NestJS API; the only deployment workflow publishes the landing page
and the web app (see [GitHub Pages](#github-pages-landing-page-and-web-app)).

From the repository root, run `npm ci` and then either `npm run dev:backend`
for TypeScript watch mode or `docker compose up --build` for the containerized
backend. Both expose `GET http://localhost:3000/health`, returning
`{"status":"ok"}`. Stop Compose with `docker compose down`.

Keep local environment values in ignored `apps/backend/.env` files. The
container uses the configuration in `compose.yaml`; add any local-only values
there or through a Compose environment file when a feature needs them.

AI generation is currently a server-side function, not an HTTP endpoint. See
[AI plan generation](features/ai-plan-generation.md#local-setup-and-usage) for
credentials, function usage, and container configuration. A successful health
check does not verify the AI provider.

Hosting, release automation, and rollback procedures will be designed only when
the team resumes deployment work.

## GitHub Pages: landing page and web app

One GitHub Pages site serves both web parts of the project:

- https://taqix.github.io/hackyeah-2026/ is the landing page (`apps/website`).
- https://taqix.github.io/hackyeah-2026/app/ is the web app: the Expo app in
  `apps/mobile`, exported for the web.

**Workflow.** `.github/workflows/pages.yml` runs on pushes to `main` and
`develop` that touch `apps/website/**`, `apps/mobile/**`, `packages/**`, the root
`package.json` or `package-lock.json`, `scripts/build-pages.mjs` or the workflow,
and on a manual run. It installs the workspace with `npm ci`, typechecks the
website and the app, runs `npm run build:pages` and publishes `dist/pages`. Both
branches publish to the same site, so the latest deployment wins. Pull requests
that touch those paths run the same typechecks and build without deploying. To
roll back, revert the commit and push; the workflow redeploys the previous version.

**Build.** `npm run build:pages` (`scripts/build-pages.mjs`) builds both parts and
assembles them:

```text
dist/pages/
  index.html, assets/   landing page (Vite build of apps/website)
  app/                  web app (expo export --platform web)
  404.html              the app's page again, for deep links
  .nojekyll
```

- **Base path:** the script exports the app with
  `EXPO_WEB_BASE_URL=/hackyeah-2026/app`. `apps/mobile/app.config.ts` then sets
  `experiments.baseUrl`, so routes and asset URLs live under that path, and
  exports a single-page app (`web.output: single`). Without the variable
  (`expo start`, native builds) the config is `app.json` unchanged.
- **Deep links and reloads:** GitHub Pages has no rewrites; for any path without
  a file it serves the site's `404.html`. That page is the app, so
  `/hackyeah-2026/app/session/<id>` or `/hackyeah-2026/app/auth/callback?code=…`
  starts the app, which reads the URL. The status is 404, which browsers ignore
  when rendering. Unknown paths outside `/app/` redirect to the landing page.
- The app's page gets light and dark `theme-color` tags and a first-paint
  background from the splash colours in `app.json`.
- The export uses a fresh Metro cache every time: a production export inlines
  `EXPO_PUBLIC_` values, and Metro's cache key ignores them. It never touches a
  running dev server's cache.
- `PAGES_BASE_PATH` (default `/hackyeah-2026`) moves the site to another path.

**Configuration.** The export needs `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Expo inlines them into the client bundle,
so they are publishable by design; row-level security protects the data.

- In CI, repository variables with those names (Settings → Secrets and variables
  → Actions → Variables) win. Otherwise the workflow uses the FitnessApp
  project's URL and publishable key written in it.
- Locally, the build reads the environment, then `apps/mobile/.env`.
- The build stops when a value is missing or the key is a secret key
  (`sb_secret_…` or a `service_role` JWT). `EXPO_PUBLIC_API_MODE=mock` builds
  the offline demo instead and needs neither.

**Local preview.** `npm run preview:pages` serves `dist/pages` the way GitHub
Pages does (file, `<path>.html`, `<path>/index.html`, else `404.html`), so deep
links and reloads behave as on the real site:

```bash
npm run build:pages
npm run preview:pages
```

Then open http://localhost:4830/hackyeah-2026/ and
http://localhost:4830/hackyeah-2026/app/. The app talks to the Supabase project
it was built with.

**Supabase Auth.** Done on 4 October 2026: the redirect allowlist has
`https://taqix.github.io/hackyeah-2026/app/auth/callback` and
`https://taqix.github.io/hackyeah-2026/app/auth/reset`, and anonymous sign-ins
are on for guest entry. Setting the Site URL to the web app is optional
([owner step 5](#supabase-product-api)).
