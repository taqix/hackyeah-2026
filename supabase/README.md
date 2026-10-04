# Supabase proof of concept

Start with [the product API handoff](../docs/features/supabase-product-api.md)
and the shareable [frontend schema and payloads](../docs/api/FRONTEND_HANDOFF.md).
This directory contains prepared migrations and
function source; it does not imply they are deployed to FitnessApp.

Local CPU checks, using the existing npm workspace dependencies:

```sh
npm run schema:product
npm run test:supabase
npm run typecheck:supabase
npm run lint:supabase
```

The tests create disposable PGlite databases with synthetic Auth accounts.
They never connect to hosted Supabase or load real credential files. AI success
examples are synthetic, and the Gemini adapter tests use a fake fetcher, never
the real API.

Migrations apply in filename order. `20261004100000_feedback_opinions_undo.sql`
adds late and changeable completion feedback, the `activity_opinion` table and
the `undo` plan version origin. `20261004110000_sport_catalog_seed.sql` is the
only seed: it upserts the sport catalog by case-insensitive name (names match
the mobile mock catalog) and adds profile rows for accounts without one. It
contains no users, plans, or other personal data.
`20261004120000_profile_username_from_auth.sql` makes signup copy the Auth
metadata name (`name`, `full_name` or `given_name`, cleaned to the contract's
username rules) into `profile.username`, fills it later only while it is empty,
and backfills empty usernames.

The function uses Gemini when both secrets are set, and answers 501
`AI_NOT_CONFIGURED` otherwise:

```sh
supabase secrets set GEMINI_API_KEY=<GEMINI_API_KEY> GEMINI_MODEL=<MODEL_ID>
```

`GEMINI_MODEL` has no default; use a model ID from Google AI Studio. Details are
in [the product API doc](../docs/features/supabase-product-api.md#ai-provider-gemini).

`POST /google/token` (Google Calendar token refresh) needs the Web OAuth client
that Supabase Auth's Google provider uses. Without these secrets it answers
501 `GOOGLE_NOT_CONFIGURED`:

```sh
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<WEB_CLIENT_ID> GOOGLE_OAUTH_CLIENT_SECRET=<WEB_CLIENT_SECRET>
```

The Google Cloud and Auth steps are in
[Mobile app on Supabase](../docs/features/mobile-supabase-integration.md#google-cloud-and-supabase-setup-owner).

The owner handles remote migrations, deployment, and Auth provider configuration.
Actual local Supabase/Deno runtime verification remains pending because those
executables were unavailable during this implementation.
