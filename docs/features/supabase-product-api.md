# Feature: Supabase product API and client contracts

Status: ready for local review; hosted application pending owner action
Owner: Supabase/API collaborator

## Outcome and scope

Web and mobile collaborators can build against the same versioned DTOs, entities,
OpenAPI description, JSON schemas, and synthetic examples. A prepared Edge
Function implements authenticated profile/catalog/plan/history/chat/completion
routes. AI integration is a replaceable adapter and is deliberately disabled
until the Gemini collaborator connects it.

Included: local signup/access fixes, product persistence, request validation,
immutable plan history, transactional RPCs, completion/feedback, client contracts,
and a deployable function scaffold. No live data or catalog rows are seeded.

Deferred: Gemini provider/model/prompt, guest demo bootstrap and AI usage limits,
chat undo, extra workout ingestion, profile summaries, Auth dashboard settings,
web/mobile screens, hosting, and deployment. These are not working capabilities
of this scaffold. Existing tournament and wearable features are outside this API.

## Client handoff

Import types and runtime schemas from `@hackyeah/contracts/product`. Request DTOs
are `UpdateProfileDto`, `GeneratePlanDto`, `SendChatDto`, and `CompleteActivityDto`.
Entities are `ProfileEntity`, `SportEntity`, `PlanEntity`, `PlanVersionEntity`,
`ChatMessageEntity`, and `ActivityCompletionEntity`. Response DTOs are exported
alongside their schemas in `apiSchemas`.

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

| Method | Path              | Request                        | Response data                                  |
| ------ | ----------------- | ------------------------------ | ---------------------------------------------- |
| GET    | `/schema`         | None                           | Named JSON schemas                             |
| GET    | `/profile`        | None                           | `ProfileEntity`                                |
| PUT    | `/profile`        | `UpdateProfileDto`             | Updated `ProfileEntity`                        |
| GET    | `/sports`         | None                           | `SportEntity[]`                                |
| GET    | `/plans/current`  | None                           | `{plan, version}` or `null`                    |
| GET    | `/plans/history`  | Pagination                     | `PlanVersionEntity[]`                          |
| POST   | `/plans/generate` | `GeneratePlanDto`              | Saved `{plan, version}`                        |
| GET    | `/chat/messages`  | Required `plan_id`, pagination | `ChatMessageEntity[]`, oldest first            |
| POST   | `/chat`           | `SendChatDto`                  | Outcome, saved messages, optional updated plan |
| GET    | `/completions`    | Pagination                     | `ActivityCompletionEntity[]`                   |
| POST   | `/completions`    | `CompleteActivityDto`          | Saved completion                               |

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
Valid generated snapshots may contain zero to seven activities. The disconnected
AI adapter still returns 501; accepting an empty snapshot does not create an AI
implementation.

Feedback effort is `easy`, `okay` (Just right), `hard`, or `too_much`.
`enjoyment` is required but nullable: in this PoC it records "Would you choose
this again?" as `yes`, `maybe`, `no`, or `null` for no opinion. The completion
screen can send null without adding a question to its design. Optional notes
use an empty string when absent. Completion actuals are immutable; opinion
edits/reset need the separate mutable model in the review.

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

The entry point wires `unavailableGenerator`, so AI routes return 501
`AI_NOT_CONFIGURED` once prerequisites are valid. Empty/unsupported catalog or
missing preferences returns 400 first. The owner/AI collaborator replaces
`provider.ts` through the `PlanGenerator` interface; server validation and atomic
persistence remain in the handler/store. Provider exceptions return sanitized
502 failures. This slice does not claim provider usage limits are implemented.

Owner steps: review the prepared migrations, apply them to a disposable project,
verify Auth providers/redirects/email confirmation, run actual local Edge/Deno
checks, then deploy the function when ready. Real catalog content and Gemini
configuration are separate tasks. Google and anonymous sign-in enablement were
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
- [x] Shared contracts compile and workspace typechecks pass.
- [ ] Hosted migration/function/Auth verification by owner.
- [ ] Gemini provider integration and guest AI limits.
- [ ] Browser and Expo smoke journey once clients are integrated.
- [ ] One teammate approval before merge.

Verification commands: `npm run schema:product`, `npm run test:supabase`,
`npm run typecheck:supabase`, `npm run typecheck`, `npm run lint:supabase`, and
`npm run lint --workspace=@hackyeah/contracts`. All passed on 3 October 2026;
the Supabase test suite passed 21 tests, with no failures or skipped tests.
Workspace typechecks covered backend, mobile, contracts, and wearable packages.
Supabase and contracts lint finished without warnings. Scoped `git diff --check`
passed. These results cover source and disposable local PostgreSQL databases,
not hosted Supabase or the Deno runtime.

Creating `feat/supabase-product-api` from `develop` was blocked by local `.git`
write permissions, including the sandbox escalation attempt. The prepared
changes remain uncommitted in the working tree on `develop`; the owner must move
them to a feature branch before review and merge.

Recovery uses a reviewed forward migration; preserve prior versions and completion
records rather than dropping tables. Function rollback can restore its previous
version while keeping the additive schema.
