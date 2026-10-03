# Supabase readiness and application schema

Status: proposed specification; no deployment or remote migration performed.
Reviewed: 3 October 2026. Owner: to assign.

**Historical broader proposal.** Use the current
[Supabase product API handoff](supabase-product-api.md) and
[mobile compatibility review](supabase-mobile-design-review.md) for implemented
local contracts and remaining gaps. Repository/runtime observations below
describe the earlier inspection: the Edge entry point, adapter, config, product
export, and revised DTOs now exist locally. The current PoC uses Supabase Edge
Functions; the NestJS boundary and `/api/v2` routes below are proposals, not the
implemented API. Hosted changes remain unapplied.

## Outcome

Supabase can provide Auth and PostgreSQL for both designed clients, but the
connected project cannot currently support their end-to-end journey. The
immediate blockers are a broken signup trigger, missing access policies, an
empty sport catalog, and missing application persistence and runtime wiring.
Extending the existing three product tables alone will not cover the design's
plan history, Undo, activity outcomes, extra workouts, and profile evidence.

This document maps the design to endpoints and database writes. The companion
[OpenAPI 3.1 schema](supabase-app.openapi.json) defines proposed request and
response payloads. Both are review artifacts, not claims that endpoints exist.
The proposed contract is version 2 because several payloads differ from the
local version-1 draft. No existing client should be switched automatically.

Sources reviewed: [design guide](../../design/README.md), all seven mobile
prototype modules under `design/prototype/`, `design/website.html`,
[product scope](../product.md), [development conventions](../development.md),
[mobile decisions](../mobile-review-2026-10-03.md), calendar and file-import
feature docs, existing migrations, shared contracts, and the product API draft.
The review concerns flows and their data requirements; it is not a rendered
visual or accessibility audit. References on other branches listed in the
design guide were not assumed to exist in this checkout.

## Verified current state

Read-only Supabase MCP checks identified one connected project, **FitnessApp**
(`xmzjxcxtsytwscktojzr`, eu-west-2), reporting `ACTIVE_HEALTHY`, PostgreSQL 17.
That establishes management/database reachability, not a successful client login.
No user records, passwords, keys, or environment files were read. SQL inspected
catalog metadata, access rules, trigger source, and aggregate counts only.

| Area                     | Observed evidence                                                                                                                              | Consequence                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signup                   | `auth.users` has `on_auth_user_created`; its function inserts into `public.profiles`, which does not exist; the real table is `public.profile` | New Auth user insertion is expected to fail when this trigger runs. This is a code/catalog finding, not a live signup attempt                           |
| Profile                  | RLS enabled; no policies; broad client grants                                                                                                  | Normal client reads see no rows and writes are denied by RLS; owner access needs explicit policies                                                      |
| Sports                   | RLS enabled; no policies; zero rows; no `generation_enabled` column                                                                            | No usable catalog, search, suggestions, or supported/preview distinction                                                                                |
| Workouts                 | RLS enabled; owner predicates on SELECT/INSERT/UPDATE/DELETE                                                                                   | Basic owner-scoped CRUD exists in SQL; a boolean `completed` cannot express all designed states                                                         |
| Privileges               | `anon` and `authenticated` hold INSERT/UPDATE/DELETE and also TRUNCATE/REFERENCES/TRIGGER on the three tables                                  | Revoke unused privileges. RLS does not govern TRUNCATE or REFERENCES; this does not prove a public HTTP truncate route exists                           |
| Signup function          | SECURITY DEFINER, no fixed search path; advisors report execution available to `anon` and `authenticated`                                      | Fix the target, fix search path, and restrict execution. A trigger-returning function's exposure is not itself proof of a working data-exfiltration RPC |
| Plans and history        | No live `plan`, `plan_version`, or `activity_completion`; only five public tables including two tournament tables                              | No durable accepted versions, active pointer, preserved completions, or chat history                                                                    |
| Migrations and functions | Supabase lists no recorded migrations and no deployed Edge Functions                                                                           | Local files have not been evidenced as deployed; tables appear provisioned outside recorded migration history                                           |
| Auth configuration       | Google provider, anonymous sign-in, email confirmation, mail delivery, and redirect allowlist not inspected                                    | These remain unverified; project health does not validate them                                                                                          |
| Local runtime            | No `supabase/config.toml`; Supabase CLI not found. NestJS exposes only `/health`; no standalone `apps/web` implementation                      | There is no runnable full-stack Supabase app in this checkout                                                                                           |
| Local drafts             | Untracked product contract, baseline/product migrations, handler factory, ports, validation, and persistence tests existed before this review  | Preserve this work; it is a starting point, not shipped functionality                                                                                   |
| Edge wiring              | Handler factory has injected auth/store/generator interfaces; no entry point, Supabase store adapter, or concrete provider adapter             | A route list alone cannot serve requests                                                                                                                |
| Contract packaging       | `@hackyeah/contracts` exports only `./wearables`; root Zod is 3.25.76, contracts Zod is 4.6.5                                                  | Export the product contract and align dependency resolution before wiring the handler                                                                   |

Security advisor findings: four tables with RLS and no policies, mutable
`handle_new_user` search path, and SECURITY DEFINER execution grants.
Remediation references: [missing policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable),
[anonymous function execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
RLS's default denial and table-wide privilege exceptions follow
[PostgreSQL's row-security documentation](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Architecture and ownership

`AGENTS.md` remains authoritative: clients use Supabase Auth; **NestJS owns
application data and AI calls**. Proposed application URLs are `/api/v2/...`.
NestJS verifies the access token and derives the owner UUID; requests never
authorize a client-supplied `profile_id` or `user_id`. Share schemas in
`packages/contracts`; keep each client UI independent.

The existing [Supabase-only draft](../superpowers/specs/2026-10-03-supabase-mvp-architecture-design.md)
describes conversational approval but says its written spec awaits review. It
contradicts the authoritative runtime boundary. If the owner adopts that
alternative, the same proposed paths can be mounted under
`https://<project-ref>.supabase.co/functions/v1/product-api/v2`; one authenticated
Edge Function replaces the NestJS application boundary. Do not ship two
independent implementations of business rules. Database entities and payloads
below work with either host; the draft's client-writable CRUD/RPC grants must
be reconciled with the selected boundary.

Auth remains Supabase SDK functionality: `signUp`, `signInWithPassword`,
`signInWithOAuth({provider: "google"})`, `resetPasswordForEmail`, password
update after recovery, refresh, and sign-out. Web alone uses
`signInAnonymously()` before guest bootstrap. A publishable key identifies the
application; it does not identify the person. Anonymous Auth users have the
`authenticated` database role and need the same owner predicates as other
users. See [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous).

The design's email-first account-exists branch is not a ready-made public
Supabase account-lookup API. Select an entry UX before implementing it; do not
infer existence from every password error. Any custom discovery endpoint
would need an explicit decision about account enumeration and rate limiting.
Registration must handle confirmation-required responses without a session.
Google/recovery redirects need web allowlisted URLs and an Expo development
build's deep-link scheme: [mobile Auth redirects](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

## Feature coverage

`Draft` means relevant local source exists, not that the feature works remotely.

| Design feature                                   | Required API/data                                                                          | Current coverage                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Mobile welcome/email/Google; web guest           | Supabase Auth, signup profile trigger, guest bootstrap                                     | Live signup target broken; providers unverified; bootstrap missing                   |
| Questionnaire and edits (2–4, 9.4)               | One validated preferences JSON per profile, revision counter                               | Draft preferences mostly match mobile; live profile writes blocked                   |
| Sport chips/search; web ranked sport choice      | Catalog with stable IDs, metric schemas, availability flag; suggestions                    | Draft catalog read only; live catalog empty; ranking missing                         |
| Calendar connection and free-time planning       | Ephemeral availability intervals, source/permission distinction                            | Mobile service exists; generator integration missing                                 |
| First plan/loading/failure/quiet week (5.7–5.13) | Atomic generation; nullable current plan; valid empty snapshot                             | Draft rejects empty snapshots, so cannot implement the quiet week                    |
| Home and earlier/future weeks (5–5.10)           | Active version per week, session states, history                                           | Draft has one global active pointer; no per-week projection                          |
| Steps on Home                                    | Device step service and its permission/error states                                        | Device service exists; no Supabase write is needed                                   |
| Non-gym logging/file fill (6.1, 6.2, 6.9, 6.10)  | Catalog-driven metrics, normalized units and per-field provenance                          | Local import service exists; draft lacks boolean/enums/provenance/catalog validation |
| Gym reps/rest/timed holds/end early (6.3–6.8)    | Stable exercise IDs, reps/time planned sets, actual sets, actual duration, history prefill | Draft supports repetitions/weight logs only; no timed sets or start state            |
| Completion/feeling/notes (7)                     | Completion referencing original version plus editable opinion                              | Draft has three effort values; design has four; enjoyment is incorrectly mandatory   |
| Chat change/diff/stale/clarification (8–8.14)    | Version checks, canonical diff, safe reply outcomes, request receipts                      | Draft supports reply/clarification/replacement; diff/Undo/quick replies missing      |
| Move/skip missed session (5.5, 8.15)             | Stable activity ID; schedule revision or explicit skipped state                            | No skipped state in draft                                                            |
| Extra workout added in chat (8.16)               | Separate history record, clarified metrics, Edit/Undo                                      | Missing; must not create a planned session or change plan progress                   |
| You summary/evidence (9–9.3)                     | Derived, validated summary with owned fact references                                      | Missing; do not fabricate evidence or replace answers with inferred preferences      |
| Opinions/reset/switch activity on (9.5)          | Mutable choose-again value, global reset revision; excluded sport IDs                      | Exclusion preference exists in draft; opinion reset/update missing                   |
| Appearance/privacy/connections (9.6–9.7)         | Device settings/permissions; explicit AI context allowlist                                 | No server write for appearance, steps, or native permission state                    |
| Calendar/history (10–10.1)                       | Canonical week snapshots plus outcomes and extras; each accepted version                   | Snapshot history draft exists; calendar aggregation and per-week pointers missing    |

The website is a front-end demo using fixed ranking/chat rules and React state;
it is not connected to Supabase. It uses `comfort`, `places`, `company`,
`sessions`, `minutes`, and `slot`; mobile uses the richer questionnaire below.
Map `scratch/occasional/routine` to
`starting_out/occasionally_active/some_routine`. Map sport slugs to catalog IDs;
never send `running` where a bigint ID is required. The proposed optional
`preferred_company: ["alone", "others"]` preserves the web's companion choice;
it is an addition requiring agreement. Named web time slots have no numeric
hours in the design: agree their mapping to `preferred_window` rather than
inventing it. Mobile can generate with `sport_id: null` to explore from saved
interests; the web can pass its explicitly chosen supported sport.

## Endpoint inventory

All application endpoints require an Auth access token, including guest calls.
Paths below are relative to `/api/v2`. Each request/response is specified in the
OpenAPI file. `Partial` means a version-1 route is drafted but its target
contract/behavior needs extension. Read operations never call the AI provider.

| Method and path                          | Purpose                                                         | Supabase writes                                                | Draft   |
| ---------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- | ------- |
| GET `/profile`                           | Answers/name/revision counters                                  | None                                                           | Partial |
| PUT `/profile`                           | Replace validated answers with optimistic profile revision      | `profile`; mark summary stale                                  | Partial |
| GET `/sports`                            | Catalog, previews and substring search                          | None                                                           | Partial |
| POST `/sports/suggestions`               | Rank enabled sports using saved answers                         | None; deterministic first implementation                       | Missing |
| POST `/guest/bootstrap`                  | Seed only the verified anonymous user, idempotently             | Profile, plan/week/version, demo completions/feedback, receipt | Missing |
| GET `/plans/current`                     | Canonical version for selected/current week, or null            | None                                                           | Partial |
| GET `/plans/history`                     | Cursor-paged immutable versions                                 | None                                                           | Partial |
| GET `/plans/versions/{version_id}`       | Inspect one owned historical snapshot                           | None                                                           | Missing |
| POST `/plans/generate`                   | Build one week from preferences and explicit availability       | Plan/week/version, activity registry/state, receipt, AI usage  | Partial |
| POST `/plans/{plan_id}/undo`             | Restore immediately preceding change as a new version           | Version/week pointer, chat, receipt                            | Missing |
| GET `/activities`                        | Sessions from canonical weekly snapshots, with outcomes         | None                                                           | Missing |
| GET `/calendar`                          | Canonical sessions and extras for a date range                  | None                                                           | Missing |
| POST `/activities/{activity_id}/start`   | Lock gym session against plan edits                             | `activity_state`, receipt                                      | Missing |
| GET `/gym/history`                       | Last actual owned sets for exercise prefill                     | None                                                           | Missing |
| GET `/completions`                       | Completed activity logs with feedback                           | None                                                           | Partial |
| POST `/completions`                      | Save actuals and feedback in one transaction                    | Completion, feedback, state, receipt; stale summary            | Partial |
| GET `/chat/messages`                     | Cursor-paged conversation                                       | None                                                           | Partial |
| POST `/chat`                             | Revision, reply, clarification, skip/move, or extra workout     | Chat/receipt; version or state or extra log; AI usage          | Partial |
| GET `/extra-workouts`                    | Extra activity history                                          | None                                                           | Missing |
| PUT `/extra-workouts/{workout_id}`       | Edit an extra through the same logging form                     | Extra log/feedback revision, receipt; stale summary            | Missing |
| POST `/extra-workouts/{workout_id}/undo` | Remove only this extra from visible history                     | Extra tombstone, receipt; stale summary                        | Missing |
| GET `/feedback`                          | Opinions and dated supporting facts                             | None                                                           | Missing |
| PUT `/feedback/{feedback_id}`            | Set yes/maybe/no or clear that opinion                          | Feedback/profile feedback revision, receipt; stale summary     | Missing |
| POST `/feedback/reset`                   | Clear all choose-again opinions, preserve activity/effort/notes | Feedback/profile feedback revision, receipt; stale summary     | Missing |
| GET `/profile/summary`                   | Derived text with evidence and freshness                        | None                                                           | Missing |
| POST `/profile/summary/refresh`          | Explicit retry/rebuild of stale derived summary                 | Summary/evidence, receipt, AI usage                            | Missing |

Feedback and extra-workout writes never revise the schedule implicitly. Saving
answers currently has an unresolved immediate-vs-next-week behavior; this draft
saves answers without automatically changing the current week, then supports an
explicit chat revision. That proposed default must be reconciled with screen 9.4
before delivery. No endpoint is needed for a greeting, theme, rest countdown,
navigation placement, step count, marketing copy, or private calendar contents.

## Payload conventions and examples

Identifiers are UUIDs except sport bigint IDs, transported as positive decimal
strings within PostgreSQL's signed-bigint range. All instants are ISO 8601 with
an offset; SQL uses `timestamptz`. `week_start` is a Monday date in the person's
IANA timezone. Version numbers are monotonically increasing for a logical plan;
an expected version refers to the selected week's active version. Never add
seven fixed 24-hour periods to calculate local weeks across DST.

Responses use `{ "data": ..., "meta": { "contract_version": "2",
"request_id": "<uuid-or-null>", "next_cursor": "<cursor-or-null>" } }`.
Failures use `error: {code, message, retryable}` instead of `data`, with the
same metadata. Reads return an empty list or null when legitimately empty.
Every mutation has a UUID `request_id`; identical retries return the recorded
result, while the same ID with different normalized input yields 409.
Proposed body cap: 64 KiB; bounded intervals and a seven-session week fit within
it. The old handler's 32 KiB cap is a version-1 constraint.

Saved preferences example (sport IDs are illustrative, not live catalog rows):

```json
{
  "request_id": "00000000-0000-4000-8000-000000000001",
  "expected_profile_revision": 0,
  "username": "Ana",
  "preferences": {
    "starting_comfort": "starting_out",
    "sessions_per_week": 3,
    "session_minutes": 20,
    "preferred_window": { "start_hour": 7, "end_hour": 11 },
    "activity_interests": ["1", "2"],
    "discovery_preference": "occasional",
    "available_locations": ["outdoors", "home"],
    "available_equipment": [],
    "avoidances": ["jumping"],
    "starting_obstacles": ["time"],
    "excluded_activity_types": [],
    "timezone": "Europe/Warsaw"
  }
}
```

No selected sports requires `discovery_preference: "explore"`. At least one
place is required; lists contain no duplicates. Sessions are 1–7; planned
minutes are 5–60 in steps of five. A preferred window is null or whole hours
within 07:00–21:00, at least one hour wide. Equipment is explicit; a selected
gym does not imply equipment. Catalog references are checked on the server.

Generation example:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000002",
  "expected_version": 0,
  "sport_id": "2",
  "week_start": "2026-10-05",
  "availability": {
    "source": "device_calendar",
    "captured_at": "2026-10-04T16:00:00+02:00",
    "slots": [{ "start_at": "2026-10-05T07:00:00+02:00", "end_at": "2026-10-05T11:00:00+02:00" }]
  }
}
```

Availability is input, not an appointment upload: sorted non-overlapping
half-open `[start_at, end_at)` slots only. `manual` means free time explicitly
chosen by the person; refused/error/unavailable calendar access is never
silently converted into an empty or fully free calendar. Reject stale/future
capture times under a documented freshness policy; re-read after calendar
changes. `slots: []` is valid when a successful read found no free time and
produces a validated empty plan, without a pointless AI call. Persist the
availability source/capture time for diagnostics, not raw intervals inside
idempotency receipts. Store a canonical request hash instead.

Catalog metric example:

```json
{
  "key": "duration",
  "description": "Time",
  "required": true,
  "unit": "s",
  "display_unit": "min",
  "display_scale": 60,
  "represents_session_duration": true,
  "value_schema": { "type": "integer", "minimum": 1 }
}
```

Store duration in seconds and distance in metres. Display value is stored
value divided by `display_scale` (60 for minutes; 1000 for kilometres). The
prototype's duration rows say `min` while comments say stored seconds: normalize
at the client/API boundary. Metrics accept numbers, booleans, or bounded strings
according to the catalog's limited JSON Schema; at most five keys, no calories,
exactly one required duration metric for a non-gym log. Reject unknown keys,
missing required values, non-finite/negative values, wrong units, and invalid
enums. Do not store arbitrary provider sensor fields or route samples here.

Completion example:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000003",
  "plan_version_id": "00000000-0000-4000-8000-000000000010",
  "activity_id": "00000000-0000-4000-8000-000000000011",
  "completed_at": "2026-10-05T07:22:00+02:00",
  "actual_duration_seconds": 1260,
  "metrics": { "duration": 1260, "distance": 2140 },
  "metric_sources": { "duration": "fit", "distance": "fit" },
  "gym_log": [],
  "feedback": { "effort": "okay", "choose_again": null, "notes": "Comfortable pace." }
}
```

`metric_sources` values are `typed`, `planned_default`, `fit`, or `gpx` and must
have exactly the supplied metric keys. Imported values are reviewed by the
person; no import automatically completes a session. Save no original files,
filenames, routes, GPS points, or calendar event titles. Actual duration may be
shorter than five minutes or longer than the plan; planned-minute bounds do
not apply to actuals. Proposed actual-duration cap is 24 hours, not a training
recommendation. Early-ended gym sessions still count as completed.

Effort values are `easy`, `okay` (Just right), `hard`, `too_much`; optional
choose-again opinion is `yes`, `maybe`, `no`, or null. The web demo's `right`
and `much` map to `okay` and `too_much`. Null opinion is not a negative opinion.
The version-1 contract's required `enjoyment` field must not be silently reused
with different semantics.

Gym planned sets discriminate `reps` (`repetitions`) from `time`
(`duration_seconds`). Actual logs use the same kinds plus an index and optional
actual `weight_kg` on rep sets. Weights are never model-generated. Stable
exercise IDs allow `/gym/history` to prefill the last actual weight; absent
history returns an empty list, not a fabricated zero. Rest duration belongs
to the plan; running timers/lock-screen updates are device behavior.

Chat uses `request_id`, `plan_id`, `expected_version`, bounded `message`, an
optional attached `activity_id`, and optional fresh availability. Its result
discriminates `plan_updated`, `reply`, `clarification`, and `workout_added`.
Clarification includes bounded quick replies; an unvalidated extra is not saved.
On a plan change, return the active version and a server-computed change set
with before/after activity objects, reasons for unfulfilled changes, locked IDs,
and Undo eligibility. Never trust an AI's claim that something was saved.

Summary statements reference owned facts: preference JSON pointer + profile
revision, or feedback ID + feedback revision. Resolve those references against
stored data before saving and return the facts' dates/values for the Why sheet.
Invalid/stale evidence rejects the new summary. A summary has no authority to
change the person's preferences or plan. Name, email, steps, Auth metadata,
private events, and raw imported files are excluded from model context; notes
and selected normalized workout metrics are allowed by the design.

## Proposed database schema

Keep the existing singular naming and sport bigint IDs. These are proposed
additions/extensions, not executable migrations. Auth identities remain in
`auth.users`; app code never writes that table directly.

| Table                     | Columns and constraints                                                                                                                                                                     | Purpose                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `profile`                 | Existing `id` FK Auth, `username`, `email`, `created_at`, `preferences`; add `profile_revision`, `feedback_revision`, `updated_at`                                                          | One validated answers document; name/email never forwarded to AI                                             |
| `sport`                   | Existing ID/name/is_gym/metrics; add unique stable `slug`, `generation_enabled`, `catalog_revision`                                                                                         | Immutable published metric definitions per revision; supported vs preview catalog                            |
| `exercise`                | Stable text `id` PK, `name`, short `description`, allowed tracking kinds, `weight_step_kg`, active flag                                                                                     | Gym exercise identity and last-weight lookup                                                                 |
| `plan`                    | UUID PK, `profile_id` unique FK, `created_at`; existing global `active_version_id` deprecated in v2                                                                                         | One logical training history per owner                                                                       |
| `plan_week`               | `(plan_id, week_start)` PK, `profile_id`, `active_version_id`, timezone; owner/plan/version/week composite FKs                                                                              | Keep each week's canonical snapshot; generating next week must not hide this week                            |
| `plan_version`            | UUID PK, plan/owner FKs, globally monotonic `version`, real `week_start` column, origin `generate/revise/undo`, `base_version_id`, validated `plan` JSON, summary, `request_id`, timestamps | Immutable accepted snapshots; unique `(plan_id, version)`; snapshot week matches column                      |
| `planned_activity`        | UUID PK, plan/owner FKs, `first_version_id`, sport ID; unique owner/ID                                                                                                                      | Stable identity registry across revisions; every snapshot ID must resolve to its own plan/owner              |
| `activity_state`          | `(profile_id, activity_id)` PK/FK, status `planned/started/skipped/completed`, revision, `started_at`, `skipped_at`, `completed_at`, originating request                                    | Outcomes survive plan replacement; skipped/started/completed sessions lock against later edits               |
| `activity_completion`     | UUID PK, owner/registry FKs, original `plan_version_id`, actual duration, normalized `metrics`, `metric_sources`, `gym_log`, completion/request timestamps                                  | Unique `(profile_id, activity_id)`; original version must contain the activity; completion actuals immutable |
| `extra_workout`           | UUID PK, owner/sport FKs, `occurred_at`, duration, metrics/sources/gym log, revision, request ID, nullable `deleted_at`                                                                     | History added through chat; no plan/version link and no planned-progress credit                              |
| `session_feedback`        | UUID PK, owner; exactly one completion FK or extra FK; effort, notes, nullable choose-again, revision, timestamps                                                                           | One feedback row per log; resetting opinions does not erase actuals, effort, or notes                        |
| `chat_message`            | UUID PK, owner/plan FKs, role, content, outcome, originating/result version IDs, structured change/extra result, request ID/time                                                            | Durable conversation and displayed cards; unique `(profile_id, request_id, role)`                            |
| `product_request_receipt` | `(profile_id, request_id)` PK, action, canonical input hash, final result reference/JSON, status/timestamps                                                                                 | Cross-action idempotency, conflict detection, stored-result replay before another AI call                    |
| `ai_usage`                | `(profile_id, usage_date, operation)` PK, counter; pending invocation reservation keyed by request ID                                                                                       | Atomic quota enforcement across devices/retries; do not store provider credentials or raw prompts            |
| `profile_summary`         | Owner PK/FK, source profile/feedback revisions, status, validated statement JSON/evidence, generated/updated time                                                                           | Derived description/summary, refreshed after underlying facts change                                         |

`workout` is the legacy table, not a second active source of truth. Retain it
during an explicit data migration; do not make clients dual-write it and new
completions. Existing boolean rows cannot recover lost plan versions, effort,
or set provenance. The live project had no workout rows at review time, but
recheck before any later migration. Leave tournament tables outside the MVP.
Wearable storage already has a local migration and server extraction package;
it is separate from the core log model and was not live in this project.

Index owner and date filters: `(profile_id, week_start)` on plan weeks,
`(profile_id, created_at DESC, id DESC)` on versions/chat,
`(profile_id, completed_at DESC, id DESC)` on completions,
`(profile_id, occurred_at DESC, id DESC)` on extras, and feedback target FKs.
Index plan/version/registry references. For gym history, use owned completion
lookup first; add an exercise/set projection only if measured query cost
justifies it. Do not add a general JSONB index without a query needing it.

## Access rules and transaction boundaries

Enable RLS on every exposed table. For any allowed user-scoped read, use
`TO authenticated USING ((SELECT auth.uid()) = profile_id)` (profile uses `id`).
UPDATE policies require SELECT plus both USING and WITH CHECK. Catalogs permit
only intended reads. Ordinary clients cannot mutate catalog rows, plan
versions, state, receipts, summaries, or completion history directly.
Prefer a restricted server database role; when a server operation uses a role
that bypasses RLS, explicit verified-owner filters remain mandatory.
See [Supabase access rules](https://supabase.com/docs/guides/database/postgres/row-level-security).

Existing draft RPCs are `save_plan_version`, `save_chat_reply`, and
`complete_activity`. Retain their good invariants, extend their contracts, and
add guest bootstrap, outcome/start, Undo, extra log, opinion/reset, and summary
save transactions as needed. Owner-taking privileged RPCs must be server-only.
The old `complete_activity` RPC derives `auth.uid()` and is callable only with
the person's JWT; an adapter cannot call it with service role instead. Either
forward the verified JWT for that path or implement a server-only equivalent.
Restrict SECURITY DEFINER execution, use a fixed empty search path and qualified
relations, and review exposed schemas before enabling any RPC.

Mutation sequence:

1. Verify JWT, validate bounded input, derive owner. Check receipt before AI.
2. Read saved answers/catalog and target weekly version. Build an explicit
   model context allowlist; reserve quota atomically when a provider call is needed.
3. Treat generated text/operations as untrusted. Validate shape, catalog
   references, beginner scope, equipment/avoidances, unique stable IDs,
   one planned session per local day, no overlaps, current/next permitted week,
   free-time fit, and immutable locked activity objects. Check both start and
   end local dates; the old validator can admit some midnight-crossing slots.
4. Lock the owner's plan/profile and relevant state rows in a consistent order;
   compare expected weekly version and any profile/feedback/state revision.
   Recheck locks acquired while AI was running. For a successful revision,
   insert snapshot, update only its weekly pointer, save chat/diff and receipt
   together. Any error rolls back all application changes.
5. Completion locks the same owner before validating its referenced snapshot,
   prevents duplicate completion even across versions, inserts actuals and
   feedback, marks state completed, and records a receipt atomically.
6. Undo is allowed only for the newest eligible change in that week. Restore
   its previous snapshot as a new version; never delete a version or logged
   activity. If restoration would alter/remove a started, skipped, or completed
   activity, return `UNDO_UNAVAILABLE`. A completed extra is unrelated to plan
   Undo; its own Undo tombstones only that extra and excludes its evidence.

The schema can express bounds and unions, but JSON Schema alone cannot enforce
ownership, catalog-driven metric validity, timezone/week fit, unique local
days, equipment suitability, idempotency, or valid evidence. Implement these
as runtime checks and database constraints/transactions. Neither a valid JSON
shape nor an AI-generated summary proves safe application behavior.

Errors: 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 404 `NOT_FOUND` for absent
or other-owned resources; 409 revision/request/completion/locked/Undo conflicts;
413 `PAYLOAD_TOO_LARGE`; 429 `RATE_LIMITED` with Retry-After; 502 invalid AI
output/provider failure; 503 unavailable dependencies or unconfigured AI.
Never return provider diagnostics, credentials, or another owner's existence.
Model timeout/invalid output leaves the active plan and completion history intact.

## Configuration still required

- Repair the signup trigger and reduce grants; review policies under both
  permanent and anonymous authenticated identities.
- Reconcile the hand-created live schema with migration history and run a
  disposable local full-migration check before the owner applies anything.
- Add local Supabase configuration and explicit Auth settings/redirects; only
  placeholder configuration names belong in documentation. Server-only inputs:
  `SUPABASE_URL`, a suitable server database credential, AI provider key/model.
  Client inputs: project URL, publishable key, and reachable application API URL.
- Seed agreed sports/exercises and metric schemas. Initially enable only gym,
  fitness, running, and football. Walk/swim/mobility examples are not evidence
  that generation is implemented for them; label preview sports clearly.
- Implement token verification, persistence adapters and application routes;
  wire the provider once, then both clients. Keep hosting/provider selection open
  as required by current project instructions.
- For an approved Edge alternative, add an entry point/import configuration,
  deliberate CORS origins and JWT verification consistent with signing keys.
  Do not confuse publishable keys with access tokens or rely on gateway behavior
  without testing it. See [Edge authentication](https://supabase.com/docs/guides/functions/auth).
- Enforce guest AI quota server-side (the PoC draft proposes 10 requests per
  identity per UTC day); define quota semantics for retries and summary calls.
  A request receipt must prevent repeated model calls for a completed retry.

Supabase services alone do not implement the app's plan logic. Realtime is
optional for cross-device refresh; refetch after writes/on resume is sufficient
initially. File Storage is unnecessary for the locally parsed import flow.
No vector database is needed to cite structured profile facts.

## Open decisions and deferred features

Resolve before freezing v2: authoritative NestJS vs the Supabase-only proposal;
email-first branching; web company/time-slot mapping; whether answer edits
revise this week; preferred hours as a preference vs a hard constraint (the
design permits an out-of-window Friday, while the draft validator rejects it);
chat duration rules (old chat copy limits 5/10/20, current sliders allow 5–60);
catalog IDs/metrics and whether stationary-bike access suffices; availability
freshness and fallback UX; optional session semantics; summary owner/provider;
gym start/resume behavior and native lock-screen work.

Proposed schema defaults: 5–60 planned minutes in steps of five; zero activities
for a valid no-slot week; optional flag for a session; preferred time remains
an optimization target and an explicit exception can be displayed, while real
free-time fit stays mandatory. These extend the draft and require owner review.
Optional sessions are excluded from the required progress denominator; extras
always are. Skipped required sessions remain in the denominator but are not
treated as negative feedback. Confirm the progress rule with the design owner.

Future contracts, outside current screens/MVP: Google Calendar OAuth connections,
automatic watch ingestion UI, notifications, data export/deletion, guest cleanup
and account conversion. Account deletion would need session revocation and a
tested deletion order: the draft's RESTRICT links to historical versions can
block naive cascades. Do not present download/delete controls as working yet.
Health/pain replies must not introduce condition-specific planning or medical
claims. XP, levels, tournaments, friends, GPS/maps, calories, voice input, and
exercise videos remain out of scope.

## Verification evidence and acceptance criteria

Checks executed during this review:

- Read-only hosted table/migration/function listings, metadata SQL, and security
  advisors: succeeded; findings recorded above. No remote writes occurred.
- `npm run typecheck --workspace=@hackyeah/contracts`: passed.
- `node --test supabase/tests/blockers.test.mjs supabase/tests/product-persistence.test.mjs`:
  final rerun **3 passed**. The first run had one `42601` syntax failure; a
  disposable migration application, individual persistence run, and complete
  rerun passed. Initial failure cause is not established; do not treat this as
  hosted Supabase integration coverage.
- Standalone handler TypeScript probe with `tsc --noEmit
--allowImportingTsExtensions --module nodenext --moduleResolution nodenext
--target es2022 --strict --skipLibCheck supabase/functions/product-api/handler.ts`:
  failed, including incompatible Zod 3/4 schema types and optional pagination
  output. This is a diagnostic probe, not an existing workspace script.
- Specification JSON parsing, local schema-reference checks, operation-ID
  uniqueness, and example validation: results recorded when artifact checks finish.

PGlite tests simulate Auth roles and `auth.uid()`; they do not validate GoTrue,
PostgREST, JWT gateway checks, Google callbacks, quotas, device permissions,
or the hosted project's current configuration. No live user signup or browser/
Expo end-to-end journey was performed.

Required acceptance evidence for implementation:

- [ ] Email/Google onboarding on web and a physical Expo build; confirmation,
      recovery, refresh, and invalid-session states behave correctly.
- [ ] Two permanent accounts and two isolated web guests cannot read/change
      each other's data, including via direct REST/RPC bypass attempts.
- [ ] Every enabled sport generates a usable beginner week; preview sports
      cannot be generated; empty availability produces the quiet-week state.
- [ ] Invalid AI output, failed generation, stale revisions, and duplicate
      requests preserve active plans and actuals; completed retries avoid new AI calls.
- [ ] Next-week generation preserves this week's canonical calendar; historical
      versions and completed activity references remain readable.
- [ ] Gym rep and timed sets, last-weight prefill, early end, and generic metric
      logging/imports work with normalized units and correct feedback values.
- [ ] Start/completion/chat races cannot alter locked activity objects; Undo
      preserves history and rejects ineligible changes.
- [ ] Chat extras support clarification, Edit, Undo and calendar display without
      increasing planned progress; feedback resets preserve actuals and notes.
- [ ] Every summary statement has resolvable owned evidence; stale/failed
      summaries never overwrite answers or leak excluded context.
- [ ] Actual local Supabase, app lint/type/build checks and owner-reviewed
      migration evidence attached; one teammate approval before merge.

Suggested delivery sequence: repair configuration locally; agree/publish shared
v2 contracts and catalog; implement Auth/answers/guest; generate weekly versions;
complete/log activities; revise/move/skip with concurrency; add Undo/extras;
then evidence summaries and feedback editing. Owner handles remote migrations,
deployment, Git publishing and merge.
