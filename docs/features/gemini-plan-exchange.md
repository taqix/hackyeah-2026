# Feature: Universal Gemini workout planning exchange

Status: ready for review
Owner: team
Issue/PR: pending

## Problem and user outcome

The initial adapter only created plans from preferences and availability, with
different description/series shapes for ordinary and gym sessions. The exchange
now supports weekly creation and chat modifications using a database sport catalog,
workout history, a user description and the full conversation. Added workouts
include readable instructions; modifications return add/delete operations and a
reply for the user.

## Scope

- Included: shared types/schemas, catalog-specific Gemini schema, provider adapter,
  prompt, request/output validation and deterministic provider tests.
- Deferred: UI slider, DB catalog queries, conversation storage, authenticated
  controllers and transactional plan persistence. There are no plan callers in
  the mobile starter on this branch.
- Affected areas: backend and shared contracts.

## Contract and integration

Import `generatePlan` (or the compatibility name `createPlan`) from
`@hackyeah/backend`; import types and validators from `@hackyeah/contracts/plan`.
Both adapter names accept the new request and return the new response. This is a
breaking JSON contract change; string IDs, gym sport exercise catalogs and
exercise IDs are rejected along with the old request/output JSON.

See runnable examples in `apps/backend/test/fixtures/initial.input.json` and
`modify.input.json`, with corresponding `*.expected-output.json` files.
See the [JSON contract reference](gemini-json-contract.md) for complete examples
and field-by-field details.

### Input

The application supplies:

- `mode`: `create` or `modify`.
- `planning_window`: `{ start, duration }`, bounding all additions and deletions.
- `preferences`: existing fields, replacing `session_minutes` with positive
  numeric `preferred_duration`. Interest/exclusion values are numeric database sport IDs.
- `available_slots`: raw calendar free intervals, also `{ start, duration }`.
- `user_description`: profile text, possibly empty.
- `sports`: a JSON array populated from the database.
- `previous_week_events`, `current_week_events`, `target_window_events`: workout
  context. The last array includes existing workouts in a future target window.
- `conversation`: the entire preceding conversation in chronological order,
  with `role: user | assistant` and `content`; excludes the latest prompt.
- `user_prompt`: the latest non-blank prompt for `modify`, or null for `create`.

All durations in slots/preferences are seconds. Starts are ISO 8601 timestamps
with explicit UTC offsets. `preferences.timezone` is an IANA timezone used for
local dates and Monday–Sunday week counts. The caller computes window instants
from local calendar boundaries; a week crossing a daylight-saving change need
not be exactly 604800 seconds.

Each existing workout includes `id`, `sport_id`, `time_slot`, `description`, its
workout details, `status: planned | completed | skipped`, and `editable`. Repeated
IDs across arrays must have identical values (object key order is irrelevant).
Historical sports can be absent from today's catalog. Skipped workouts do not
occupy the final schedule. Completed workouts remain protected and count toward
creation frequency. The caller must supply all workouts relevant to the target
window, including neighboring workouts whose buffers could overlap additions.

### Sport catalog

All sport/workout IDs, deletion IDs and preference interest/exclusion IDs are
positive safe integer JSON numbers (`1` through `9007199254740991`), never numeric
strings. The examples use sport IDs `1` and `2` and workout IDs `101` and `102`.

Every sport has `id`, `name`, `description`, `is_gym: 0 | 1` (`1` for gym), and optionally
`buffer_seconds`, an allowance for EACH side of the activity. The default is
300 seconds; supply 900 for swimming where appropriate. Availability must not
already subtract these same buffers.

Non-gym sports have a `metrics` array. Each metric defines `key`, `description`,
`required`, `value_schema`, and optionally `unit` and
`represents_session_duration`. The supported schema subset is:

- `number`/`integer`: optional `minimum`, `maximum`, numeric `enum`.
- `string`: optional `minLength`, `maxLength`, string `enum`, and
  `format: date | date-time | time | duration`.
- `boolean`.

Unknown schema keywords and inconsistent bounds/enums are rejected. Integer
metric intervals must contain at least one integer. Metric keys
begin with a letter and contain letters, digits or underscores. A metric marked
`represents_session_duration: true` is numeric, uses seconds, and must equal the
returned slot duration if present. Other time metrics may use their documented
units and refer to an active portion rather than the whole session.

Gym sports contain metadata only, without `metrics` or an `exercises` catalog.
Generated gym workouts contain exercise names, descriptions, sets and repetitions;
they cannot include exercise IDs. Sets/repetitions must be positive integers and
are uniform per exercise.

### Output

`{ events, message }` contains changes only:

- Add: `action: add`, `sport_id`, `time_slot`, overall `description`, plus
  non-gym `metrics` and ordered non-empty `parts: [{ description }]`, or gym
  ordered non-empty `exercises: [{ name, sets, repetitions,
description }]`.
- Delete: only `action: delete` and `id`.
- `message`: non-blank for modification, null for creation.

Rescheduling/editing deletes the old workout and adds its replacement. Unchanged
workouts are omitted; the application assigns IDs to additions. Operation order
does not affect validation. An empty operations array is valid, including a
modification reply asking for clarification or explaining why changes cannot fit.

### Preferences and scheduling

Creation cannot delete, exceed preferred duration or exceed weekly frequency in
a week to which it adds a workout. Shorter sessions may fit smaller slots.
Modification mode authorizes the model to interpret explicit chat requests for a
different duration/frequency; those preferences are soft in this mode, and saved
preferences are never mutated. The prompt requires retaining the preferred values
unless chat asks otherwise. Natural-language intent is not proved by structural
validation; applications needing exact per-request dose limits should additionally
check them in `reviewContent` against their own validated conversation policy.

Both modes enforce the planning window, future five-minute-grid starts, buffer
fit in a single supplied free slot, sport selection/exclusions, gym access,
non-overlap and one session per local start date. The validator checks additions
against all retained workouts, with deletions applied first. It does not reject
an unchanged schedule solely because historical workouts already violate current
preferences.

`reviewContent` remains available for equipment, location, swimming and workout
content checks. Text quality and duration arithmetic inside free-text instructions
need content review beyond JSON validation.

## Application boundary and errors

The adapter reads `GEMINI_API_KEY` and `GEMINI_MODEL` server-side (or receives them
as options). Use a model ID without `models/`. No provider credentials belong in
clients. The configured timeout is 60 seconds and output budget is 8192 tokens.

The complete request, including generated schema, is limited to 2,000,000 UTF-8
bytes. Oversized requests raise `INPUT_TOO_LARGE`; conversation is never silently
truncated. Provider context limits can still reject a smaller request and are
reported through the existing provider error path. Missing/invalid configuration,
network, timeout, provider refusal, incomplete generation and malformed JSON
remain explicit errors. Invalid input/output raises `PlanValidationError` without
echoing personal content.

Empty creation availability returns `{ events: [], message: null }` without a
provider call. Empty modification availability still calls Gemini, allowing
deletions or a reply. Content review happens before a generated result is returned.

The backend caller must load only owned workouts and determine `editable` after
authentication; a client flag is not authorization. Recheck ownership/completion
and plan version in the persistence transaction. Preserve previous versions and
completed activities, apply a valid revision immediately, and prevent stale
requests from overwriting newer plans. This adapter returns validated operations
and does not save them or claim persistence succeeded.

## Acceptance criteria

- [x] Both modes share one exchange and use start/duration slots.
- [x] Catalog sports and metric formats constrain generated workouts.
- [x] Gym/non-gym workouts include actionable ordered instructions.
- [x] Modification includes full conversation and a user-facing reply.
- [x] Valid deletions and replacement schedules are checked against retained work.
- [x] Completed, past and non-editable workouts cannot be deleted.
- [x] Provider errors and invalid responses cannot return a validated result.
- Account isolation and transaction verification: application integration follow-up.
- Web/mobile UI verification: not applicable; no plan UI consumes this contract yet.

## Verification

Run from the repository root:

```sh
npm run test:plans
npm run typecheck
npm run lint
npm run format:check
node_modules/.bin/prettier --config packages/.prettierrc.json --check 'packages/contracts/src/plan*.ts' 'packages/contracts/src/schemas/*.json' 'apps/backend/src/*.ts' 'apps/backend/test/**/*.ts' 'apps/backend/test/fixtures/*.json' 'apps/backend/scripts/*.mjs' docs/features/gemini-plan-exchange.md
git diff --check
```

After rebasing onto the NestJS backend bootstrap, the backend builds with Nest
and runs its tests from TypeScript-emitted JavaScript so decorator metadata is
preserved. The test runner copies fixture and prompt assets into ignored
`.test-dist/`. Backend build/dev/test/typecheck scripts build contracts first.

The backend/contract builds, full workspace TypeScript checks and ESLint passed.
All 40 backend tests passed under Node 22.23.3, including `/health`, integer metric
range regressions, numeric database IDs, gym metadata without exercise catalogs
and malformed provider envelopes. The shared wearable suite
also passed (38 tests). Backend/shared-plan Prettier and `git diff --check` passed.
A production-entry smoke check served `/health` and loaded the compiled Gemini
adapter, shared contracts and prompt with a mocked provider response on Node 22.

No live Gemini request was made; mocked tests do not prove a configured model
accepts every generated schema. Docker is unavailable in the review environment,
so the revised image has not been built or exercised. See the
[review and fix report](../reviews/gemini-plan-contract-review-2026-10-03.md).

Gemini schema conversion uses its documented subset, translates exclusive local
branches to `anyOf`, and retains authoritative local bounds/string validation.
See [Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output).

## Deployment, rollback and review

No database migration. Shared contracts use Ajv and ajv-formats for runtime
validation. Coordinate all future callers on this
breaking JSON contract before releasing. Roll back the adapter, contracts and
prompt together; do not mix old requests with new schemas.

Before merging, attach check evidence and obtain the repository's teammate review.
