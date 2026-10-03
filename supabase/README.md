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
examples are synthetic; the runtime AI adapter returns `AI_NOT_CONFIGURED` until
the provider collaborator connects it.

Migrations apply in filename order. `20261004100000_feedback_opinions_undo.sql`
adds late and changeable completion feedback, the `activity_opinion` table and
the `undo` plan version origin. `20261004110000_sport_catalog_seed.sql` is the
only seed: it upserts the sport catalog by case-insensitive name (names match
the mobile mock catalog) and adds profile rows for accounts without one. It
contains no users, plans, or other personal data.

The owner handles remote migrations, deployment, and Auth provider configuration.
Actual local Supabase/Deno runtime verification remains pending because those
executables were unavailable during this implementation.
