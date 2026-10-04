# Runtime status

## Supabase product API

The hosted Supabase project (FitnessApp) runs the
[product API](features/supabase-product-api.md), and the mobile app uses it by
default; see [Mobile app on Supabase](features/mobile-supabase-integration.md).

Live state after the 4 October 2026 push:

- **Migrations:**
  - Applied up to `20261004110000_sport_catalog_seed`, including
    `20261004100000_feedback_opinions_undo`.
  - `20261004120000_profile_username_from_auth` (signup copies the Auth
    name into `profile.username`) is prepared and not yet applied.
  - The wearable migration `20261003120000` is intentionally not applied.
  - The catalog has 7 working sports and 15 previews.
- **Function:** `product-api` is redeployed with `verify_jwt = true`. It
  includes the Gemini adapter, late feedback, opinions, Undo, and Google token
  refresh (`POST /google/token`).
- **Secrets:** `GEMINI_API_KEY` and `GEMINI_MODEL` are set.
- **Auth:**
  - The Google provider is on, and manual identity linking is on.
  - Redirects are allowlisted for `hackyeah2026://auth/{callback,reset}`,
    `exp://**/--/auth/{callback,reset}` and
    `http://localhost:8081/auth/{callback,reset}`.
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
5. **Smoke test** from the app:
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
deployment workflow, or hosted NestJS API.

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
