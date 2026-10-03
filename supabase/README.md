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
They never connect to hosted Supabase or load real credential files. There is no
seed SQL or real user data. AI success examples are synthetic, and the Gemini
adapter tests use a fake fetcher, never the real API.

The function uses Gemini when both secrets are set, and answers 501
`AI_NOT_CONFIGURED` otherwise:

```sh
supabase secrets set GEMINI_API_KEY=<GEMINI_API_KEY> GEMINI_MODEL=<MODEL_ID>
```

`GEMINI_MODEL` has no default; use a model ID from Google AI Studio. Details are
in [the product API doc](../docs/features/supabase-product-api.md#ai-provider-gemini).

The owner handles remote migrations, deployment, and Auth provider configuration.
Actual local Supabase/Deno runtime verification remains pending because those
executables were unavailable during this implementation.
