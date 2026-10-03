# Mobile design and product API compatibility review

Status: review complete; corrected core contract ready locally; remaining features listed below
Reviewed: 3 October 2026
Scope: compatibility of the mobile design in `design/prototype/` with the
shared product API. This is a source and contract review, not an Expo runtime,
visual, accessibility, or hosted end-to-end test.

## Contract and evidence status

Use [`supabase-product-api.md`](supabase-product-api.md) and
`packages/contracts/src/product.ts` as the current local v1 contract and
implementation handoff. The hosted product API is pending owner action. The
read-only hosted recheck found the five old tables, no product persistence
tables, and the signup trigger still targeting plural `profiles` while the
existing table is singular `profile`. No remote write or credential read was
performed.

The prototypes are browser JSX fixtures with sample data and local interactions;
they are not mobile app screens wired to API calls. Screen coverage below means
the source depicts a UI/state, not that the end-to-end action is implemented.

The broader [`supabase-app-schema.md`](supabase-app-schema.md) is a historical
v2 proposal. It is useful for identifying model gaps, but its routes and schema
are not current API behavior; it also records an alternative architecture that
must not override the current product API handoff. Design guide sections marked
“Not decided yet” or proposal-only remain decisions, not delivery requirements.

## Screen-by-screen compatibility

| Flow and source evidence                                                                                                                                       | Local contract/API coverage                                                                                                   | Status and required follow-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Onboarding** — `onboarding.jsx`: email/Google entry, preference questions, catalog search, review/calendar access state.                                     | Auth is direct Supabase Auth; profile/preferences read and replacement, sports catalog, and plan generation are in v1 routes. | **Covered in contract; hosted pending; client unwired.** Map prototype sport slugs to decimal-string catalog IDs; load suggestions/search from the catalog, never persist labels as IDs. Profile replacement also carries `excluded_activity_types`, so switching a sport off has a persistence path; a dedicated screen action is not a separate API requirement. Account-exists discovery remains an unresolved UX/security choice, not a Supabase API feature.                                                                                                                                       |
| **Home** — `home.jsx`: selected days, week strip/navigation, session and step states, missed-session actions, quiet/loading/error frames.                      | Current plan/history and completion reads exist; availability snapshots feed generation/chat. Device step counter is local.   | **Partial.** Saved empty plans now support quiet weeks; mobile may explore from preferences without a selected sport (`sport_id: null`; web can keep its explicit sport). Add canonical weekly selection and a calendar/activity projection for Home/Calendar consistency. History can reconstruct the latest version per week after all pages are fetched, but the current-plan endpoint exposes only the global active pointer. Add persisted `started` and `skipped` activity state for gym locking and missed-session outcomes. Native step permission/status and count require no Supabase tables. |
| **Workouts and feedback** — `workout.jsx`: generic catalog metric form, `.fit`/`.gpx`-filled values, gym rep/rest/timed/early-end states, completion feedback. | Completion and gym/metric values exist in v1, but the request shape is narrower than these screens.                           | **Partial; model extension required for all designed logging states.** Support dynamic boolean/enum metrics, canonical units, and per-field source provenance; distinguish planned from actual duration. Gym needs a stable exercise registry, timed sets, actual timed/rep set shape, start state, and last-weight history. The local contract now accepts `too_much` effort and nullable choose-again opinion (`enjoyment: null` means no opinion); later opinion edits still need a separate mutable record, independent of actual completion data.                                                  |
| **Chat** — `chat.jsx`: replies/clarifications, update diff, stale/offline states, Undo, move/skip, and an extra workout logged from chat.                      | v1 supports version-checked revisions, reply/clarification, and persisted messages.                                           | **Partial.** Keep version checks, idempotent request IDs, and completion preservation. A displayed diff needs canonical before/after data. Undo requires an explicit safe restore action that writes a new version. Move/skip needs stable activity state. Extra workouts need separate records, edit, and Undo; they must not become planned events or affect plan progress.                                                                                                                                                                                                                           |
| **You/profile** — `profile.jsx`: preference edits, evidence-backed assistant summary, per-activity feedback and reset, settings/privacy.                       | Profile preferences and completion records exist.                                                                             | **Covered:** answer replacement (including exclusions). **Local-only:** appearance and native permission/settings state need no server write. **Missing if retained:** mutable choose-again opinions and reset, separate from immutable completion actuals. **Undecided/new AI call:** generated summary plus owned evidence and freshness; do not ship static sample claims as user data or imply a summary API exists.                                                                                                                                                                                |
| **Calendar/history** — `calendar.jsx`: month agenda of planned/done/skipped sessions and plan versions.                                                        | Version history exists; current API returns plan snapshots and completions separately.                                        | **Partial.** Add canonical weekly selection and a calendar projection joining planned sessions, outcomes, and separate extras. Do not infer skipped/started status from missing completion.                                                                                                                                                                                                                                                                                                                                                                                                             |

## Blocker and API audit results

Three independent fast subagents reviewed the design mapping, migrations/access
rules, and Edge API/contracts. Confirmed corrections are implemented locally:

- A saved plan can contain an empty activity list, independently of no saved plan.
- Mobile generation can send `sport_id: null`; eligibility respects enabled
  sports, exclusions, and selected-only interests. Web can still choose one ID.
- Feedback accepts all four displayed effort choices and a null opinion.
- `GET /schema` and its OpenAPI schema agree on the response envelope.
- Reusing a request ID across completion/plan/chat actions produces
  `REQUEST_CONFLICT`, including receipt lookup before an AI call.
- Exercise IDs cannot be ambiguous within a plan/log; invalid catalog numeric
  bounds are rejected by the shared schema.

Local PostgreSQL checks also verify corrected signup, owner isolation, anonymous
denial, preserved completions/versions, owner deletion of the new product graph,
and blocked direct deletion of referenced history. The owner-deletion check does
not implement an account-deletion API or cover legacy workout/wearable records.
Another test parses actual persisted PostgreSQL results with the frontend schemas.

The hosted security advisor still reports missing profile/sport policies and the
signup function's mutable search path/execution grants. Prepared fixes remain
unapplied. See Supabase's remediation notes for
[missing policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[fixed search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable),
and [restricted function execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
Tournament policy notices are outside this product slice.

## Local, hosted, missing, and undecided

- **Local source exists:** v1 contracts, schemas, synthetic examples, prepared
  persistence/function source, and local verification are described in the
  product API handoff. These do not establish hosted deployment.
- **Hosted pending:** the product tables/functions and corrected signup path
  have not been applied remotely. Do not tell mobile collaborators that hosted
  signup or product persistence is available yet.
- **Prototype-only:** all six flows are design fixtures, not wired mobile
  screens. Local clickable sample interactions are not API integration.
- **Missing model/API for demonstrated behavior:** weekly selection/projection,
  activity start/skip lifecycle, gym exercise/timed-set/history support,
  normalized typed metrics and provenance, chat diff/Undo, extra-workout CRUD/
  Undo, and independently editable opinions.
- **Undecided/proposal-only:** assistant profile summary and evidence require a
  product decision and a separately specified AI operation. Optional-session
  progress semantics and new-activity behavior also need decisions before
  implementation. Do not treat the historical v2 proposal as approval.
- **No server schema needed:** device steps, appearance, local calendar
  permission, private calendar contents, and navigation placement. Send only
  free-time intervals and availability metadata where plan/chat APIs require
  them; never send calendar event titles.

## Recommended implementation order and handoff

1. Hand off the corrected shared contract and regenerated schemas/examples for
   empty weeks, nullable mobile exploration sport, aligned effort/opinion feedback,
   and the schema response envelope. The artifact handoff is ready locally;
   hosted application remains an owner task.
2. Add canonical weekly plan selection/projection and activity lifecycle
   (`planned`, `started`, `skipped`, `completed`), including concurrency rules
   across completion and chat revision. Keep old versions and actual completions.
3. Extend catalog/logging contracts for typed metrics, canonical units and
   provenance; add gym exercise identity, timed sets, actual duration and
   history prefill.
4. Specify and implement chat diff/Undo and separate extra-workout records,
   including ownership, idempotency, edit/tombstone behavior and progress rules.
5. Specify mutable choose-again opinions independently from completion actuals.
   Decide whether to add the summary/evidence AI call only after product review.
6. Implement the prototype screens against the agreed shared contract. Handle
   Auth redirects/recovery and local calendar/step permissions in the mobile
   client; normalize gateway/network failures and retain stable request IDs for
   retries.

Before parallel client work, hand off generated contract artifacts and exact
request/response fixtures. Client engineers must not invent persistence by
storing UI sample states, infer a skip from an absent completion, or treat
one history page as a complete weekly calendar index. Backend/API work remains
local until the owner performs hosted migration/deployment steps. Follow the
owner's review rules for branch, acceptance evidence, and teammate approval.

## Verification

- [x] `npm run schema:product` regenerates current OpenAPI/JSON schemas and both
      example artifacts.
- [x] `npm run test:supabase`: 21 tests passed, none failed or skipped.
- [x] `npm run typecheck:supabase` and `npm run typecheck` passed, including backend,
      mobile, shared contracts, and wearable workspaces.
- [x] `npm run lint:supabase`, contracts lint, shared Prettier, and scoped
      `git diff --check` passed without warnings.
- [ ] True parallel-connection race tests against a disposable Supabase instance.
      Current local tests check serialization/conflict invariants on PGlite, not
      a deployed multi-session Supabase system.
- [ ] Undo eligibility and mutable opinion tests once those features exist.
- [ ] Actual Supabase CLI/Deno serving and bundling; neither executable is
      installed in this environment.
- [ ] Browser preview review of the referenced states and Expo smoke journey
      once client screens are integrated.
- [ ] Owner-run hosted migration/Auth/function verification; no hosted action
      is implied by local checks.

Profile edits currently replace answers only; they do not regenerate the active
plan. There is no optimistic profile revision check, so concurrent full-document
edits can overwrite one another. Agree when preference changes affect upcoming
sessions, and add a profile revision guard before implementing that automatic
behavior. This is separate from the existing plan-version conflict protection.
