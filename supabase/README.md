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
seed SQL or real user data. AI success examples are synthetic; the runtime AI
adapter returns `AI_NOT_CONFIGURED` until the provider collaborator connects it.

The owner handles remote migrations, deployment, and Auth provider configuration.
Actual local Supabase/Deno runtime verification remains pending because those
executables were unavailable during this implementation.
