# Deployment plan

## Status and environments

Hosting is TBD and no deployment workflow exists yet. This document defines the
workflow to implement, not a currently available deployment service.

Use local development and one hosted demo environment initially. Backend/web
are hosted; Expo runs locally for judging. Add additional environments when the
team needs them rather than duplicating infrastructure upfront.

## Triggers and release identity

Implement a GitHub Actions workflow named `deploy.yml` with:

- A `push` trigger for `main` after the PR workflow is established.
- A `workflow_dispatch` trigger for manual deployment.
- Required formatting, lint, type checks, relevant tests, and backend/web builds
  for the exact commit being released, or verified results for that same commit.
- A deployment job that runs only after all required checks succeed and invokes
  the selected hosting provider's CLI.

Feature PRs target `develop`; a reviewed release PR promotes `develop` to `main`.
Run checks on both PR targets. Merging to `develop` does not publish the hosted
demo; merging to `main` does.

Manual CLI entry, **after the workflow exists**:

```sh
gh workflow run deploy.yml --ref main
gh run list --workflow deploy.yml --limit 5
gh run watch <run-id> --exit-status
```

Initially allow manual releases only from `main`. Validate the workflow ref so
manual dispatch cannot publish an unchecked feature branch. Record the deployed
commit SHA in workflow output and backend release metadata. Serialize releases
to the demo environment, and avoid interrupting an in-progress database migration.

## Provider selection checklist

Before implementing the workflow, record:

- Backend provider/project, CLI version, deployment command, and runtime support.
- Web provider/project, build command, output path, and SPA route fallback.
- Supabase project reference and database connection/pooling choice.
- Demo URLs, allowed web origins, and the Expo API URL.
- Responsible teammate, account access, budget, and relevant service limits.
- Provider-specific release/rollback commands and credential names.

Backend and web providers may differ; keep their release steps coordinated around
compatible API contracts. NestJS must run on a service suitable for its runtime.

## Secrets and configuration

Commit `.env.example` files with placeholders and descriptions. Store deployment
credentials in GitHub Actions secrets and runtime secrets in the hosting provider.
Keep local `.env` files ignored.

Public client configuration includes the API URL, Supabase URL, and the chosen
publishable client key. Database credentials, Supabase privileged keys, and AI
provider keys belong only on the backend or in narrowly scoped deployment jobs.
Public client keys do not replace backend authorization and ownership checks.

The backend should validate required configuration at startup and expose a health
endpoint suitable for deployment verification. Define readiness behavior during
scaffolding. Do not put real secrets or raw user messages in deployment logs.

## Database migrations

Version SQL schema changes under `supabase/migrations/`. Test them from an empty
local database and against representative existing data before release. The
Supabase CLI supports applying pending migrations with `supabase db push`;
configure the target explicitly before running it.
[Migration workflow](https://supabase.com/docs/guides/deployment/database-migrations)

Apply compatible migrations once through the release workflow. Prefer additive
schema/API changes so the previous backend and locally running mobile clients
continue to work during rollout. Separate destructive cleanup from the feature
release and confirm backup/recovery arrangements before changing important data.
Never run local reset commands against the hosted demo database.

## Release sequence and verification

1. Identify the `main` commit and pass the required checks for it.
2. Verify target environment and required secrets; apply compatible migrations.
3. Deploy backend and check its health/release identity.
4. Deploy web using the compatible backend URL and public client configuration.
5. Run the demo smoke journey: guest entry, seeded plan, questionnaire, generation,
   completion/feedback, and an immediate validated chat revision.
6. Check email/password login and ensure two visitors cannot access one another's
   records. Confirm a generation failure leaves an existing plan intact.
7. Have the mobile owner run Expo against the released backend and record results.

Track backend and web outcomes separately. If either fails, mark the release
incomplete and keep or restore a compatible known-good client/backend pairing.

## Rollback

Keep the last known-good backend/web release identifiers. Roll back application
releases using the selected provider's documented mechanism, then repeat health
and demo checks. Prefer backward-compatible schema changes so application rollback
does not require reversing a migration. Do not automatically undo migrations:
use a reviewed forward repair, or a deliberate restoration procedure if needed.

Record the failed commit, symptoms, restored release, and follow-up work. Document
actual provider commands here before declaring deployment ready.
