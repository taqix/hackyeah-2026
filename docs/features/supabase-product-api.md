# Feature: Supabase product API and client contracts

Status: ready for local review; hosted application pending owner action
Owner: Supabase/API collaborator

## Outcome and scope

Web and mobile collaborators can build against the same versioned DTOs, entities,
OpenAPI description, JSON schemas, and synthetic examples. A prepared Edge
Function implements authenticated profile/catalog/plan/history/chat/completion
routes. AI runs through the replaceable `PlanGenerator` adapter: Gemini when its
secrets are set, otherwise a stub that answers 501 `AI_NOT_CONFIGURED`.

Included: local signup/access fixes, product persistence, request validation,
immutable plan history, transactional RPCs, completion/feedback, client contracts,
and a deployable function scaffold. Since 4 October it also covers feedback given
after the log or changed later, mutable "choose again" opinions with reset, Undo
of the newest chat change, and a sport catalog seed. No users or plans are seeded.

Deferred: guest demo bootstrap and AI usage limits, extra workout ingestion,
profile summaries, Auth dashboard settings, web screens, hosting, and deployment.
These are not working capabilities of this scaffold. The mobile client is tracked
in [the mobile Supabase integration](mobile-supabase-integration.md). Existing
tournament and wearable features are outside this API.

## Client handoff

Import types and runtime schemas from `@hackyeah/contracts/product`. Request DTOs
are `UpdateProfileDto`, `GeneratePlanDto`, `SendChatDto`, `CompleteActivityDto`,
`UpdateFeedbackDto`, `PutOpinionDto`, `ResetOpinionsDto`, and `UndoPlanDto`.
Entities are `ProfileEntity`, `SportEntity`, `PlanEntity`, `PlanVersionEntity`,
`ChatMessageEntity`, `ActivityCompletionEntity`, and `ActivityOpinionEntity`.
Response DTOs are exported alongside their schemas in `apiSchemas`.

Generated artifacts:

- [Standalone frontend schema and payload handoff](../api/FRONTEND_HANDOFF.md)
- [OpenAPI 3.1](../api/product-api.openapi.json)
- [JSON schemas](../api/product-api.schemas.json)
- [Synthetic requests and responses](../api/product-api.examples.json)
- [Additional mobile design states](../api/product-api.design-examples.json)
- [Screen-by-screen mobile compatibility review](supabase-mobile-design-review.md)

Examples are fixtures for client development, never actual project IDs, users,
or persisted records. `npm run schema:product` regenerates the artifacts from
the shared schemas and route declarations. Custom Zod refinements additionally
check uniqueness, timezone, schedule overlaps, and preferences; those cross-field
rules cannot all be expressed in the generated JSON Schema.

Base URL after owner deployment:
`https://<PROJECT_REF>.supabase.co/functions/v1/product-api`.
Every request except OPTIONS supplies `Authorization: Bearer <SESSION_ACCESS_TOKEN>`
and `apikey: <SUPABASE_PUBLISHABLE_KEY>`. Authenticate with Supabase Auth directly;
this function has no registration/login endpoint. The gateway requires a JWT,
and the handler independently validates it with Supabase Auth's user endpoint.
Session tokens and keys never go in URLs. Email, tokens, and username are not
included in the AI context.

| Method | Path                    | Request                        | Response data                                  |
| ------ | ----------------------- | ------------------------------ | ---------------------------------------------- |
| GET    | `/schema`               | None                           | Named JSON schemas                             |
| GET    | `/profile`              | None                           | `ProfileEntity`                                |
| PUT    | `/profile`              | `UpdateProfileDto`             | Updated `ProfileEntity`                        |
| GET    | `/sports`               | None                           | `SportEntity[]`                                |
| GET    | `/plans/current`        | None                           | `{plan, version}` or `null`                    |
| GET    | `/plans/history`        | Pagination                     | `PlanVersionEntity[]`                          |
| POST   | `/plans/generate`       | `GeneratePlanDto`              | Saved `{plan, version}`                        |
| POST   | `/plans/undo`           | `UndoPlanDto`                  | Saved `{plan, version}`, origin `undo`         |
| GET    | `/chat/messages`        | Required `plan_id`, pagination | `ChatMessageEntity[]`, oldest first            |
| POST   | `/chat`                 | `SendChatDto`                  | Outcome, saved messages, optional updated plan |
| GET    | `/completions`          | Pagination                     | `ActivityCompletionEntity[]`                   |
| POST   | `/completions`          | `CompleteActivityDto`          | Saved completion                               |
| PUT    | `/completions/feedback` | `UpdateFeedbackDto`            | Completion with the new feedback               |
| GET    | `/opinions`             | None                           | `ActivityOpinionEntity[]`, newest first        |
| PUT    | `/opinions`             | `PutOpinionDto`                | Saved opinion, or `null` when cleared          |
| POST   | `/opinions/reset`       | `{}`                           | `{cleared}`                                    |

Success is `{data, meta: {contract_version: "1", request_id: UUID | null}}`.
Failure is `{error: {code, message, retryable}, meta}`. Platform gateway errors
may arrive before the handler and have a different shape; clients must normalize
those and network failures. Collections return `[]` when empty. A profile created
by signup initially has `preferences: null`. No plan is represented by `data: null`,
not a fake plan. History is newest first; completions are newest first.
A saved quiet week has `{plan, version}` with `version.plan.activities: []`;
it is different from a user who has no saved plan. `GET /schema` also uses the
success envelope, documented as `SchemaResponseDto`.

Pagination uses `limit` (default 50, range 1–100) and `offset` (default 0,
range 0–10000). Clients page until a response contains fewer than `limit` rows.
Offset pagination is intended for this small proof of concept; reload the list
when a new record arrives rather than assuming pages remain stable during writes.

IDs are UUID strings, except catalog sport IDs, which are positive PostgreSQL
bigint values transported as decimal strings. Never convert sport IDs to JS
numbers. Preferences store catalog IDs rather than preview labels. Questionnaire
values follow the reviewed prototype: 1–7 sessions, 5–60 minutes in five-minute
steps, and a nullable hour window. Metrics have a key, label, type, unit, required
flag and optional bounds, with at most five per sport. `generation_enabled: false`
marks sports that cannot be used for generation.
The local metric DTO uses `label`, `type: number | text`, and values in its
declared `unit`; it is narrower than the prototype's `description/value_schema`
catalog. Boolean/enum controls, canonical storage/display conversion, and
import provenance require the follow-up contract described in the mobile review.

Generation requires the `sport_id` key: pass a decimal-string ID for an explicit
sport, or `null` for mobile generation from saved preferences. For null selection,
only enabled, nonexcluded sports are eligible; `selected_only` additionally
restricts them to `activity_interests`. An empty eligible catalog is a 400 error.
Valid generated snapshots may contain zero to seven activities. Without the
Gemini secrets the AI routes return 501.

Feedback effort is `easy`, `okay` (Just right), `hard`, or `too_much`.
`enjoyment` is required but nullable: in this PoC it records "Would you choose
this again?" as `yes`, `maybe`, `no`, or `null` for no opinion. The completion
screen can send null without adding a question to its design. Optional notes
use an empty string when absent. A completion may be saved with `feedback: null`
and given feedback later with `PUT /completions/feedback`; metrics, sets and
the completion time stay immutable. Opinions that can change or be reset live
in `/opinions`, one per client-chosen `activity_key`.

`POST /plans/undo` restores the version before the active one when the active
version is a chat revision of the same week, as a new version with origin
`undo`. It makes no AI call and replays by `request_id`. Anything else returns
409 `NOTHING_TO_UNDO`; a change that touched a logged session returns 409
`UNDO_LOCKED`.

Generation/chat requests include a caller-generated UUID `request_id`, expected
version, and free-slot snapshot with source and capture time. Send free intervals
only, never event names/descriptions. Slots must be sorted and non-overlapping.
Mobile can obtain them from the existing device calendar availability service;
web or calendar denial can use explicitly supplied manual availability. An empty
slot array means no free time, not an unavailable calendar.

Use expected version 0 for the first plan and the current version for subsequent
weeks or replacements. Chat outcomes are `plan_updated`, `reply`, or
`clarification`. Only a validated `plan_updated` creates and immediately activates
a new version. Reply/question outcomes persist both messages without changing
the version. Completed activity IDs and objects remain unchanged in same-week
revisions. Starting a new week retains the previous versions and completions.
Gym plans specify repetitions, never weights; only completion logs accept weight.

Retry a transport failure with the same request ID and identical DTO, including
availability capture time. Receipts are checked before another AI call, and the
SQL transaction also deduplicates concurrent retries. A 409 `VERSION_CONFLICT`
requires reloading the plan and creating a new request ID for the revised request.
`REQUEST_CONFLICT` indicates a request ID reused with different data.

## Prepared database changes

The hosted inspection and read-only recheck on 3 October found singular `profile`, `sport`, and
`workout` tables, empty tournament tables, no recorded migrations/functions,
and a signup trigger incorrectly inserting into `public.profiles`.

`20261003130000_profile_sport_workout_baseline.sql` creates missing baseline
tables without deleting existing rows, fixes signup to target `public.profile`,
fixes the trigger function search path, removes client execution rights, and
replaces policies with owner-only profile/workout access plus authenticated
catalog reads. Explicit grants replace broad preexisting/default grants.

`20261003140000_product_persistence.sql` adds `generation_enabled`, `plan`,
`plan_version`, `chat_message`, `activity_completion`, and internal
`product_request_receipt`. Composite foreign keys constrain owner relationships.
Clients can read their own product history but cannot write versions/messages/
completion tables directly. Legacy `workout` remains a separate existing table;
these API completion records are stored in `activity_completion`.

`20261004100000_feedback_opinions_undo.sql` makes completion feedback nullable,
adds the owner-only `update_completion_feedback` RPC, the `activity_opinion`
table with owner RLS for every operation, and the `undo` version origin.
`20261004110000_sport_catalog_seed.sql` upserts the catalog by case-insensitive
name (with a unique index on the lowercased name) and backfills missing
profiles. Working sports have `generation_enabled = true`; previews do not.

- `save_plan_version`: server-only, owner-serialized, expected-version checked,
  immutable version insert and active pointer switch in one transaction.
- `save_chat_reply`: server-only, checked conversation persistence without a revision.
- `complete_activity`: authenticated RPC; derives owner from `auth.uid()`, checks
  the activity/version, validates log fields and deduplicates completion.
  Request IDs reused across plan, chat, and completion actions conflict; the
  API checks receipts before an AI call and SQL rechecks under the owner lock.

Internal receipts intentionally have RLS and no client policy/grant. The signup
function remains SECURITY DEFINER because it provisions a profile from an Auth
trigger; it uses a fixed empty search path and qualified names, and is not a
client-callable RPC. All privileged API calls filter by the verified owner.

## Runtime and owner handoff

Only source and disposable local databases were changed. The live FitnessApp
signup bug and access-policy gaps remain until the owner applies the migrations.
No migrations, functions, provider settings, or Auth settings were applied remotely.
No real credential files were opened; examples contain placeholders only.

`supabase/config.toml` configures the local project and `product-api` with JWT
verification. The function uses native fetch to Supabase Auth/Data APIs; it does
not add a second Supabase SDK or a NestJS runtime dependency. Deno's import map
pins Zod to the same version as the contracts package.

Runtime configuration names (values supplied by the platform/owner):

| Name                      | Example                             | Exposure                            |
| ------------------------- | ----------------------------------- | ----------------------------------- |
| SUPABASE_URL              | `https://<PROJECT_REF>.supabase.co` | Client/server                       |
| SUPABASE_PUBLISHABLE_KEY  | `<PUBLISHABLE_KEY>`                 | Client/server                       |
| SUPABASE_ANON_KEY         | `<LEGACY_ANON_KEY>`                 | Platform fallback only              |
| SUPABASE_SERVICE_ROLE_KEY | `<SERVER_ONLY_KEY>`                 | Function only; never a client value |
| GEMINI_API_KEY            | `<GEMINI_API_KEY>`                  | Function secret; never a client value |
| GEMINI_MODEL              | a model ID from AI Studio           | Function secret; no default model   |

### AI provider (Gemini)

`index.ts` wires `createGeminiGenerator` (`gemini.ts`) when both `GEMINI_API_KEY`
and `GEMINI_MODEL` are set; otherwise `unavailableGenerator` answers 501
`AI_NOT_CONFIGURED`. Empty/unsupported catalog or missing preferences return 400
first. Set the secrets with:

```sh
supabase secrets set GEMINI_API_KEY=<GEMINI_API_KEY> GEMINI_MODEL=<MODEL_ID>
```

Saving AI plans also needs `SUPABASE_SERVICE_ROLE_KEY`, which the hosted platform
provides to functions.

- **Request.** One `generateContent` call with the system prompt (`prompt.ts`), a
  JSON context, and a per-call `responseJsonSchema`: generate returns
  `{activities, summary}`, chat returns `{outcome, activities | null, message}`.
  The context holds the preferences, eligible sports, the gym exercise library
  (`exercises.ts`, mirroring the mobile `EXERCISES` IDs), free slots already cut to
  the preferred window and the future (`schedule.ts`), the week's kept and planned
  sessions, completion effort, and for chat the recent messages and attached
  activity. Usernames, emails and feedback notes are never sent.
- **Retries.** HTTP 408, 429 and 5xx are retried up to three times with jittered
  backoff, honouring `Retry-After`. Everything, including one re-ask, shares a
  90-second deadline.
- **Post-processing.** The adapter sets `week_start` and `timezone`, keeps a
  returned ID only when it belongs to the same week's previous plan (otherwise a
  new UUID), and re-inserts completed and past sessions verbatim. It never adjusts
  a session. When local validation fails, it asks once more with the specific
  problem, then fails with `INVALID_AI_OUTPUT` (502, retryable).
- **Errors.** Missing configuration gives 501 `AI_NOT_CONFIGURED`. Unreadable JSON,
  an incomplete answer (finish reason other than `STOP`) or a blocked prompt give
  502 `INVALID_AI_OUTPUT`. Other provider failures, including timeouts, become 502
  `PROVIDER_UNAVAILABLE`. Logs carry status lines only, never prompts or answers.
- **Validation.** A session identical to the same week's previous version skips the
  per-activity checks, as completed ones always did. That lets mid-week revisions
  and same-week regeneration keep past sessions that today's free slots or edited
  answers no longer cover.

Tests use a fake fetcher with canned answers (`supabase/tests/gemini.test.ts`);
the live provider has not been called from this repository. This slice does not
claim provider usage limits are implemented.

Owner steps: review the prepared migrations, apply them to a disposable project,
verify Auth providers/redirects/email confirmation, run actual local Edge/Deno
checks, then deploy the function when ready. The catalog seed migration supplies
the sports; the Gemini secrets are set separately. Google and anonymous sign-in enablement were
not verifiable through the available inspection tools.

The Supabase CLI and Deno executable were unavailable here. Migration files use
the existing repository timestamp convention rather than a CLI-generated name.
CPU tests use Supabase-shaped PostgreSQL roles/Auth fixtures in PGlite; they do
not substitute for actual Supabase Auth or Edge runtime smoke tests. Local host
declarations allow TypeScript checks without claiming Deno bundling was tested.

## Acceptance and verification

- [x] Fresh and existing schemas provision profiles through the corrected signup trigger.
- [x] Owner isolation, anonymous denial, and default grants are tested locally.
- [x] Invalid requests/AI output do not save a plan; current/history empty states are explicit.
- [x] Version conflicts, idempotent receipts, and preserved completions are tested locally.
- [x] Synthetic DTO examples match their runtime schemas.
- [x] Late/changed feedback, opinion isolation, Undo saves, and an idempotent
      catalog seed are tested locally.
- [x] Shared contracts compile and workspace typechecks pass.
- [ ] Hosted migration/function/Auth verification by owner.
- [x] Gemini provider adapter, tested locally with canned answers.
- [ ] Live Gemini smoke test by the owner, and guest AI limits.
- [ ] Browser and Expo smoke journey once clients are integrated.
- [ ] One teammate approval before merge.

Verification commands: `npm run schema:product`, `npm run test:supabase`,
`npm run typecheck:supabase`, `npm run typecheck`, `npm run lint:supabase`, and
`npm run lint --workspace=@hackyeah/contracts`. All passed on 3 October 2026;
the Supabase test suite passed 21 tests, with no failures or skipped tests.
Workspace typechecks covered backend, mobile, contracts, and wearable packages.
Supabase and contracts lint finished without warnings. Scoped `git diff --check`
passed. These results cover source and disposable local PostgreSQL databases,
not hosted Supabase or the Deno runtime. After the 4 October extensions the
Supabase suite passes 30 tests.

Creating `feat/supabase-product-api` from `develop` was blocked by local `.git`
write permissions, including the sandbox escalation attempt. The prepared
changes remain uncommitted in the working tree on `develop`; the owner must move
them to a feature branch before review and merge.

Recovery uses a reviewed forward migration; preserve prior versions and completion
records rather than dropping tables. Function rollback can restore its previous
version while keeping the additive schema.
