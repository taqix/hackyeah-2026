# Development plan and conventions

## Status

These are the team's agreed target conventions. `develop` already contains an
Expo SDK 57 starter in `apps/mobile`, npm workspaces, and `package-lock.json`.
Root commands include `npm start`, `npm run android`, `npm run ios`,
`npm run web`, `npm run typecheck`, and `npm run lint`. The current web command
starts Expo's web target, not the planned standalone React dashboard.

Backend, standalone web, shared packages, database migrations, and CI workflows
remain unimplemented. Existing scripts are confirmed from package manifests;
they have not been executed as part of this documentation change. Commands in
the target-script table below are planned interfaces.

## Target layout

```text
apps/
  backend/             # NestJS application API and AI integration
  web/                 # React marketing pages and dashboard
  mobile/              # React Native / Expo; setup owned by mobile collaborator
packages/
  contracts/           # Request/response types and runtime validation schemas
  config/              # Shared TypeScript, ESLint, and Prettier configuration
supabase/
  migrations/          # Versioned PostgreSQL schema changes
docs/
  product.md
  development.md
  deployment.md
  features/
    TEMPLATE.md
```

Share contracts and configuration, not client UI. Apps may depend on shared
packages; shared packages must not import from apps. Keep contracts free of
NestJS, browser, and React Native dependencies.

## Toolchain and local setup

Use TypeScript throughout, with strict checking. The agreed package-manager target
is pnpm, while the current mobile scaffold uses npm. Until a coordinated migration
lands, follow the existing README and use npm with `package-lock.json`. Do not
introduce competing lockfiles or change the mobile setup in a documentation PR.

During that migration, pin a Node release compatible with NestJS and Expo SDK 57,
pin pnpm in the root `packageManager` field, and document those versions here.
Convert the workspace lockfile to `pnpm-lock.yaml`, remove the npm lockfile in the
same migration, update root/CI commands, and verify Expo on the collaborator's
machine. CI must install the exact committed dependency graph.

The planned setup sequence after the pnpm migration and backend scaffold is:

1. Clone the repository and install the pinned Node/pnpm toolchain.
2. Run `pnpm install` after workspaces are scaffolded.
3. Copy each app's committed `.env.example` to its ignored local environment file.
4. Start local Supabase, apply migrations, and seed demo data.
5. Start backend and web; start Expo using the mobile collaborator's setup.

For local Supabase development, the CLI uses Docker-compatible containers.
`supabase start` starts local services, and `supabase db reset` recreates the
local database from migrations. Use reset only against a disposable local
database. Document the chosen CLI installation and versions during scaffolding.
[Local development](https://supabase.com/docs/guides/local-development/cli/getting-started)

Expose these root script names during scaffolding:

| Planned command | Responsibility |
| --- | --- |
| `pnpm dev:backend` | Start the API with local configuration. |
| `pnpm dev:web` | Start the React web application. |
| `pnpm dev:mobile` | Start Expo with a reachable API URL. |
| `pnpm format:check` | Check formatting without modifying files. |
| `pnpm lint` | Lint all application and shared packages. |
| `pnpm typecheck` | Type-check backend, web, mobile, and shared packages. |
| `pnpm test` | Run automated application tests. |
| `pnpm build` | Build shared dependencies, backend, and web. |

On a physical mobile device, `localhost` refers to that device. Document the
backend's reachable development URL, bind address, and Expo network setup when
the mobile scaffold lands. Test that URL on the actual judging device.

## Application and data boundaries

- Supabase provides PostgreSQL and Auth. Clients sign in using Supabase Auth and
  send their access token to NestJS.
- NestJS verifies tokens, derives the user identity, and enforces record ownership.
  Never trust a client-provided user ID as authorization.
- Application data goes through NestJS. Keep database and privileged Supabase
  credentials on the backend; use suitable database permissions and policies.
- The guest endpoint seeds data only for the requesting anonymous identity and
  can be retried without duplicating demo plans.
- Keep AI credentials and prompts on the backend. Validate AI output as untrusted
  input and apply changes in a database transaction.
- Keep controllers thin; put use-case behavior in services and persistence behind
  an explicit boundary. Do not introduce abstraction layers without a concrete need.

Suggested relational entities are user profiles, preferences, sport catalog,
plans, plan versions, scheduled activities, completion/feedback records, and
chat messages. Finalize columns and relationships in migrations when implementing
the corresponding feature. Auth identities remain managed by Supabase Auth.

## Code conventions

- Use the shared ESLint/Prettier rules; avoid app-specific style drift.
- Prefer descriptive names, small focused modules, and explicit public contracts.
- Avoid unexplained `any`, casts, silent fallbacks, and duplicated business logic.
- Validate API inputs and return consistent, actionable errors.
- Make loading, empty, failure, and retry states explicit in both clients.
- Use accessible labels, keyboard support on web, and usable touch targets.
- Log operational context without credentials or raw personal chat content.
- Keep environment templates current and document required versus optional values.
- Keep installed third-party skills separate from application code; do not reformat
  their bundled files as part of routine application changes.

## Branches, commits, and PRs

Branch from the latest `develop` using names such as `feat/guest-entry`,
`fix/plan-revision`, or `docs/deployment`. Target feature/documentation PRs to
`develop`; promote reviewed releases from `develop` to `main`. Keep each PR focused
and obtain one teammate approval before merging. Only `main` triggers the hosted
release workflow.

Write commit subjects that explain the resulting change. PR descriptions state
the problem, behavior, acceptance criteria, verification evidence, and migration
or deployment impact. Use [the feature template](features/TEMPLATE.md) for a new
feature and link the resulting document from the PR. Tracker selection is not
required to use the template; an issue can be linked when available.

Before review, sync with the PR's target branch, resolve conflicts, run relevant checks, and update
docs affected by the change. Avoid unrelated refactors and dependency churn.
Shared-contract changes must include corresponding client updates or remain
compatible with existing clients. Coordinate breaking API changes with the
mobile collaborator because local Expo clients do not update with the backend.

## Quality gates

The team reports an existing push-lint service; its configuration is not present
in this repository yet. Record its actual status-check name when wiring branch
protection. Keep local linting available regardless of that external service.

PR checks should include formatting, linting, type checks for all workspaces,
relevant automated tests, and backend/web builds. Ensure a failed required check
blocks merge. GitHub branch protection must require one approval and the actual
configured check names on both `develop` and `main`.

Prioritize tests for user isolation, request/AI validation, plan replacement,
preserved completion history, and failed-generation behavior. Mock the AI
provider for deterministic CI; do not require live model credentials for tests.
Use database integration tests where transaction and authorization behavior
matters. Do not add tests that merely repeat implementation details.

Record an Expo smoke check for changes affecting mobile: sign in, load a plan,
complete an activity, and observe a chat revision on a real device or emulator.
Backend/web deployment is gated by the complete CI result, not just push linting.

## Suggested implementation order

1. Coordinate the existing Expo starter, pnpm migration, remaining workspaces,
   and shared configuration with the mobile owner.
2. Add shared contracts, Supabase Auth, versioned schema, and ownership checks.
3. Implement email/password entry and isolated seeded guest entry.
4. Implement questionnaire, suggestions, and the four working sport journeys.
5. Add validated AI plan generation and transactional chat revisions.
6. Complete web dashboard, mobile journey, completion, and feedback.
7. Wire required PR checks and deployment triggers; verify the judging demo.

Select hosting before implementing deployment, and select the AI model before
integrating live generation. Track illness-specific behavior as a future feature.
