# Runtime status

## Supabase product API

The hosted Supabase project already runs the
[product API](features/supabase-product-api.md). A read-only check on 4 October
2026 found:

- `product-api` version 3 deployed with `verify_jwt = true`
- migrations up to `20261003140000` applied
- empty tables
- no `GEMINI_*` secrets

The mobile app uses this project by default; see
[Mobile app on Supabase](features/mobile-supabase-integration.md). The 4 October
changes are local only so far: late feedback, opinions, Undo, the catalog seed
and the Gemini adapter. Local CPU tests cover database rules, the handler and
the adapter. Real CLI, Deno, Auth and device checks remain owner work.

Owner steps to bring the hosted project up to date:

1. Apply `20261004100000_feedback_opinions_undo.sql` and then
   `20261004110000_sport_catalog_seed.sql`, after `20261003140000`. Review the
   wearable migration separately. The seed adds the sport catalog and missing
   profile rows. Without it, plan generation answers 400.
2. Deploy the function with `supabase functions deploy product-api`. The
   gateway may reject valid user JWTs when the project uses new signing keys.
   In that case, deploy with `--no-verify-jwt`: the handler verifies every token
   with Auth itself. The platform provides `SUPABASE_SERVICE_ROLE_KEY`, which
   plan saves and Undo need.
3. Set the AI secrets with
   `supabase secrets set GEMINI_API_KEY=<KEY> GEMINI_MODEL=<MODEL_ID>`. There is
   no default model. Without these secrets, generation and chat answer 501, and
   the app shows that plan building is not connected yet.
4. In Auth URL configuration, set the site URL and allowlist these redirects:
   - `hackyeah2026://auth/callback` and `hackyeah2026://auth/reset`
   - the Expo Go `exp://…/--/auth/callback` and `exp://…/--/auth/reset` URLs
   - the web origin's `/auth/callback` and `/auth/reset`
5. Optional: turn on the Google provider with its client ID and secret. The app
   shows Google sign-in only while `/auth/v1/settings` reports it as on.
6. Smoke-test from the app:
   - a new account through onboarding to its first plan
   - a log with feedback
   - a chat change and its Undo
   - a second account that sees none of the first account's data

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
