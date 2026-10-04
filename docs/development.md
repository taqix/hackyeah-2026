# Development plan and conventions

## Status

These are the team's agreed target conventions. `develop` already contains an
Expo SDK 57 starter in `apps/mobile`, npm workspaces, and `package-lock.json`.
Root commands include `npm start`, `npm run android`, `npm run ios`,
`npm run web`, `npm run typecheck`, and `npm run lint`. The current web command
starts Expo's web target, not the planned standalone React dashboard.

The NestJS backend now serves `GET /health` and has a Dockerfile and Compose
setup for local development. The standalone web app and CI workflows remain
unimplemented. Shared wearable contracts, the extraction library, and an
additive storage migration are available; see the
[integration guide](features/wearable-extraction.md). The backend commands below
have been run locally. The pnpm commands in the target-script table remain
planned interfaces.

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

| Planned command     | Responsibility                                        |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev:backend`  | Start the API with local configuration.               |
| `pnpm dev:web`      | Start the React web application.                      |
| `pnpm dev:mobile`   | Start Expo with a reachable API URL.                  |
| `pnpm format:check` | Check formatting without modifying files.             |
| `pnpm lint`         | Lint all application and shared packages.             |
| `pnpm typecheck`    | Type-check backend, web, mobile, and shared packages. |
| `pnpm test`         | Run automated application tests.                      |
| `pnpm build`        | Build shared dependencies, backend, and web.          |

On a physical mobile device, `localhost` refers to that device. Document the
backend's reachable development URL, bind address, and Expo network setup when
the mobile scaffold lands. Test that URL on the actual judging device.

### Mobile environment

The Expo app in `apps/mobile` uses the Supabase product API by default. Copy
`apps/mobile/.env.example` to `apps/mobile/.env`, which Git ignores, and fill it
in. Expo bundles every `EXPO_PUBLIC_` value into the app, so never put a secret
or service-role key there. Restart `expo start` after changing the file.

| Variable | Required | Value |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes, in Supabase mode | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes, in Supabase mode | the publishable (`sb_publishable_…`) or legacy anon key |
| `EXPO_PUBLIC_PRODUCT_API_URL` | no | defaults to `${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/product-api` |
| `EXPO_PUBLIC_API_MODE` | no | `supabase` (default) or `mock` |
| `EXPO_PUBLIC_DEBUG_LOGS` | no | `off` silences the debug logs of development builds |

Without the URL or key the app shows a setup screen that lists the missing
values. It never falls back to the mock. `EXPO_PUBLIC_API_MODE=mock` runs the
offline demo backend (demo account, Demo controls) and needs no other value; see
[Mobile app on a mocked API](features/mobile-mock-app.md). Mobile checks, run in
`apps/mobile`: `npm run typecheck`, `npx eslint src`, `npm test`,
`npm run test:remote`, `npm run test:calendar`, and `npm run test:activity-import`.

#### Debug logs

Development builds (`__DEV__`) print one line per event to the Metro terminal
and the React Native DevTools console (press `j` in `expo start`). Each line
starts with `[movo:<scope>]`:

- `http`: every product API request, response or failure, with the status,
  duration, short request ID, the 401 refresh-and-resend, transport retries
  and timeouts.
- `auth`: Auth state events, sign-in, sign-up, Google, password reset and
  sign-out attempts and outcomes, and auth deep links (kind only).
- `query` and `mutation`: React Query loads, changed refetches, failures and
  retries; mutations by their `mutationKey`. `query` also shows the remote
  data cache being invalidated or reset.
- `nav`: route changes, with IDs shortened and parameter names only.
- `plan`, `chat`, `logs`, `profile`, `calendar`: plan builds and re-plans,
  chat sends and Undo, drafts and feedback, opinions and switched-off sports,
  calendar free time (source, slot count, read time), the Movo export, and
  Google Calendar connect, token refresh, free/busy counts and export counts.
- `app`: the API mode and missing variables at start. `mock`: each mock call.

Failures use `console.warn`; the root layout keeps these lines out of LogBox.
Set `EXPO_PUBLIC_DEBUG_LOGS=off` in `apps/mobile/.env` to silence them, then
restart `expo start`. Release builds and Node tests log nothing. The logs never
contain tokens, keys, `Authorization` headers, passwords, full emails (only
`a***@example.com`), chat text, feedback notes or calendar event titles.
Request bodies appear as their keys and safe values only. The logger is
`apps/mobile/src/lib/debug-log.ts`; route new logs through it rather than
calling `console` directly.

## Application and data boundaries

- The current proof-of-concept path is the [Supabase product API](features/supabase-product-api.md):
  clients use Supabase Auth and call the prepared Edge Function with their session.
- The Edge Function verifies tokens, derives identity, validates DTOs and AI output,
  and uses owner-scoped reads plus transactional RPC writes.
  Never trust a client-provided user ID as authorization.
- RLS enforces owner access; privileged Supabase credentials remain server-only.
  The hosted project runs an earlier `product-api`; the 4 October migrations and
  function changes are not applied yet (see [Runtime status](deployment.md)).
- Guest bootstrap and limits remain follow-up work. The only seed migration adds
  the sport catalog and missing profile rows; no users, plans, or demo data are
  seeded.
- Keep AI credentials and prompts in the server function. Validate AI output as untrusted
  input and apply changes in a database transaction.
  Backend AI communication, configuration, and prompts live together under
  `apps/backend/src/ai/`. Nest copies `ai/prompts/**/*.txt` into the compiled
  output for production and watch mode; the test runner copies the same assets
  beside its compiled AI modules. Docker includes them through the backend build.
- Keep controllers thin; put use-case behavior in services and persistence behind
  an explicit boundary. Do not introduce abstraction layers without a concrete need.

Suggested relational entities are user profiles, preferences, sport catalog,
plans, plan versions, scheduled activities, completion/feedback records, and
chat messages. Finalize columns and relationships in migrations when implementing
the corresponding feature. Auth identities remain managed by Supabase Auth.

Available product API checks are `npm run test:supabase`,
`npm run typecheck:supabase`, and `npm run lint:supabase`. Regenerate its client
schemas/examples with `npm run schema:product`. The function plans with Gemini
when `GEMINI_API_KEY` and `GEMINI_MODEL` are set and answers 501
`AI_NOT_CONFIGURED` otherwise. Actual Edge/Auth runtime smoke checks and owner
deployment remain pending.

## Code conventions

### Agent instruction ownership

The repository owner explicitly requested both `AGENTS.md` and `CLAUDE.md`.
`AGENTS.md` is the only authoritative instruction file; `CLAUDE.md` forwards to it.
Keep detailed procedures in these docs and avoid duplicating them in either file.

The installed `setup-matt-pocock-skills` normally chooses `CLAUDE.md` when it exists
and avoids creating both instruction files. This repository intentionally overrides
that default at the owner's request: any setup-created `## Agent skills` block
must be added or updated in `AGENTS.md`, with configuration under `docs/agents/`.
Both root instruction files state this override. Do not append project configuration
to the forwarding file, and update an existing block rather than creating a duplicate.

### React Native / Expo skill

Before writing, reviewing, or debugging code in `apps/mobile` or another React
Native / Expo app, read and follow the repository's
[react-native-best-practices skill](../.agents/skills/react-native-best-practices/SKILL.md).
Open the relevant sub-skills linked from its `references/` table for the task.

The skill and its references are committed under `.agents/skills/` so every
checkout has the same guidance without a global installation. Claude Code uses
`.claude/skills/react-native-best-practices`, a relative symlink to that directory.
Keep the bundled upstream files intact; update the skill and its references together.
The source is [Software Mansion's skills repository](https://github.com/software-mansion-labs/skills/tree/main/skills/react-native-best-practices).

### Application code

- Use the shared ESLint/Prettier rules; avoid app-specific style drift.
- Prefer descriptive names, small focused modules, and explicit public contracts.
- Avoid unexplained `any`, casts, silent fallbacks, and duplicated business logic.
- Validate API inputs and return consistent, actionable errors.
- Make loading, empty, failure, and retry states explicit in both clients.
- Use accessible labels, keyboard support on web, and usable touch targets.
- Mobile layout: start every screen with `Screen`. It ends the screen at the
  software keyboard's top on iOS and Android (`KeyboardAvoider`), so `Content`
  scrolls to its end with the focused field in view and `BottomBar` rides
  above the keyboard; a `Sheet` does the same in its own window. Do not add a
  `KeyboardAvoidingView` or `automaticallyAdjustKeyboardInsets` per screen.
- Mobile shapes: give a `View` whose fill or border only appears later (a
  selection ring, a halo) `collapsable={false}`. React Native flattens it while
  it draws nothing, and Android re-creates it without its `borderRadius`.
- Mobile focus on the web: `PressableScale` draws the kit's focus ring for
  keyboard focus only; text fields hide the browser's square outline
  (`noBrowserOutline`) and draw their own rounded ring.
- Log operational context without credentials or raw personal chat content.
- Keep environment templates current and document required versus optional values.
- Keep installed third-party skills separate from application code; do not reformat
  their bundled files as part of routine application changes.

## Branches, commits, and PRs

Branch from the latest `develop` using names such as `feat/guest-entry`,
`fix/plan-revision`, or `docs/local-runtime`. Target feature/documentation PRs to
`develop`; promote reviewed releases from `develop` to `main`. Keep each PR focused
and obtain one teammate approval before merging. No hosting workflow is configured.

Write commit subjects that explain the resulting change. PR descriptions state
the problem, behavior, acceptance criteria, verification evidence, and migration
or local runtime impact. Use [the feature template](features/TEMPLATE.md) for a new
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

## Suggested implementation order

1. Coordinate the existing Expo starter, pnpm migration, remaining workspaces,
   and shared configuration with the mobile owner.
2. Add shared contracts, Supabase Auth, versioned schema, and ownership checks.
3. Implement email/password entry and isolated seeded guest entry.
4. Implement questionnaire, suggestions, and the four working sport journeys.
5. Add validated AI plan generation and transactional chat revisions.
6. Complete web dashboard, mobile journey, completion, and feedback.
7. Wire required PR checks and verify the local judging demo.

Cloud hosting is deferred. The server-side AI planning adapter is implemented;
see [AI plan generation](features/ai-plan-generation.md) for setup, checks, and
the remaining endpoint/storage integration. Configure and verify the chosen
provider/model before enabling live generation.
Track illness-specific behavior as a future feature.
