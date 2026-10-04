# Feature: AI plan generation

Status: ready for review (server-side generation and validation only)
Owner: backend / shared contracts

## Problem and user outcome

An inactive adult needs a manageable movement plan that fits their calendar,
interests, access, and starting comfort. After onboarding, creation produces
beginner workouts for an explicit planning window. Chat can later change those
workouts without repeating onboarding or disturbing completed activities.

For example, “Tuesday instead, and make that walk 15 minutes” can return a
Monday workout deletion and a Tuesday replacement, leaving other workouts
unchanged. The feature returns validated operations and a chat reply; the
application must save them before presenting a successful schedule update.

The feature and its [JSON contract](ai-json-contract.md) use **AI** naming because
the application contract does not depend on the chosen provider. The current
transport uses Gemini. Its environment variables, wire format, and schema
translator retain provider-specific names because they describe that adapter,
not a permanent product requirement.

## Scope and implementation status

| Area            | Implemented                                                                            | Still required for the complete product journey                                 |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Generation      | `generatePlan` supports `create` and `modify`; `createPlan` is a compatibility alias   | An authenticated application service/controller that assembles the request      |
| Contracts       | Shared types, JSON schemas, catalog-specific schema builders, and runtime validation   | Mapping owned database records and client requests to this contract             |
| Personalization | Backend system prompt uses preferences, catalog, history, profile, and conversation    | Saved preferences, production catalog, and sport-suggestion integration         |
| Calendar        | Validation uses caller-supplied free slots and sport buffers                           | Computing availability from calendar data and refreshing it before saving       |
| Revisions       | Validated add/delete operations, protected-workout checks, and optional content review | Transactional persistence, plan versions, ownership checks, concurrency control |
| Clients         | Provider-independent output shape                                                      | Web/mobile API integration, loading/error/empty states, and chat persistence    |
| Runtime         | Server-side fetch adapter, timeout, response parsing, and explicit errors              | Live provider verification, usage limits, and operational monitoring            |

No plan HTTP route, automatic weekly scheduler, or database migration for plan
storage is supplied by this feature. The NestJS module
currently registers only the health controller. A healthy backend does not
establish that generation or the end-to-end user journey works.

## End-to-end flow and responsibility boundaries

The intended application flow is:

1. Authenticate the caller and load their profile, saved preferences, plan
   version, workout history, conversation, and the current sport catalog.
   Web guests must use their own anonymous identity; mobile has no guest entry.
2. Choose an explicit planning window using local calendar boundaries. The
   product targets the coming week, but the function supports any supplied
   interval. Compute raw calendar free slots without subtracting sport buffers.
   Include relevant adjacent workouts so their buffers can be checked too.
3. Build `PlanInput` with numeric IDs and backend-derived `editable` flags.
   Include the entire preceding conversation in chronological order; put the
   newest modification message only in `user_prompt`. Creation uses `null`.
   Derive `allow_multiple_sessions_per_day` on the backend only when that newest
   request explicitly asks for multiple sessions on a local date; never trust
   a client flag or reuse authorization from an earlier request.
4. Call `generatePlan`. It validates input, requests structured output, validates
   the resulting schedule, and optionally runs application content review.
5. Recheck ownership, completion status, availability, and the active plan
   version before committing. Apply the operation set atomically as a new plan
   version; retain completed records and prior versions. Reject stale changes.
6. Return the committed schedule/version to the client and store the appropriate
   conversation records. Display the modification reply once the result is
   resolved; do not interpret the model's reply as a persistence receipt.

Steps 1–3 and 5–6 belong to the calling application and are not implemented by
the adapter. In particular, `editable: true` is contextual input, not proof of
ownership. There is no caller identity or version token in the AI exchange.
Authentication and concurrency metadata belong to the application API.

A valid chat revision is intended to replace the active plan immediately after
successful validation and saving, with no separate acceptance screen. A failed
generation, content review, or transaction must leave the existing plan intact;
initial-generation failure must not leave a partial active plan.

## Generation pipeline

The implementation in [create-plan.ts](../../apps/backend/src/ai/create-plan.ts)
executes these steps in order:

1. Serialize the input as JSON and reject unsupported values or requests above
   2,000,000 UTF-8 bytes. Validate the request with `parsePlanInput` and check the
   evaluation time.
2. For `create` with no free slots, return `{ "events": [], "message": null }`
   immediately. This still requires valid input and time, but no credentials,
   prompt read, provider call, or content review. `modify` always continues so
   deletions and useful replies remain possible without free slots.
3. Check credentials/model and read the bundled system prompt. Append the
   current evaluation time and the instruction not to repeat onboarding.
4. Send one user content block containing the complete validated request,
   including history, catalog, and conversation. These are serialized context,
   not separate provider chat turns. Request JSON with a catalog-specific
   response schema, one candidate, and an 8,192-token output limit. Recheck the
   total request-body size, including the prompt and generated schema.
5. POST to the current provider with a 60-second abort signal. Reject failed
   HTTP responses, blocked prompts, missing candidates, and any first candidate
   whose finish reason is not `STOP`.
6. Concatenate textual, non-thought parts from that candidate and parse the
   result as JSON. Validate shape, catalog details, and scheduling rules with
   `parsePlanOutput(plan, input, now)`.
7. Await `reviewContent`, if supplied, then return the validated `PlanOutput`.
   Review errors propagate to the caller; they are not wrapped or retried.

The adapter retries HTTP 408, 429, 500, 502, 503, and 504 up to three times
with exponential backoff and jitter (1, 2, and 4 second ceilings), honoring
Retry-After when supplied. Jitter spreads concurrent retries after a shared
provider failure. All attempts and waits share the 60-second deadline. If the
required wait reaches or exceeds the remaining budget, the adapter returns
`TIMEOUT` immediately without another provider request or scheduling the delay;
this also prevents oversized Retry-After values from overflowing Node's timer.
Other HTTP errors, network failures, and invalid output are not retried.
Conversation is never silently truncated,
and there is no fallback provider, JSON repair, streamed output, or partial-plan
recovery from an incomplete provider response. A valid partial schedule is a
successful result, distinct from truncated or malformed model output.

## Planning and chat behavior

| Case                                   | Expected result                                              |
| -------------------------------------- | ------------------------------------------------------------ |
| Initial creation                       | Add eligible sessions within the window; `message` is `null` |
| Only some sessions fit                 | Return fewer additions rather than relax constraints         |
| No suitable sessions fit               | Empty operations; creation reply remains `null`              |
| Move/edit through chat                 | Delete the eligible existing workout and add its replacement |
| Ambiguous or impossible chat request   | Empty operations and a non-blank clarification/explanation   |
| Empty availability in chat             | Eligible deletions or a reply; no additions                  |
| Invalid output or failed provider call | Throw; the caller preserves the active plan                  |

Operations contain changes only, not a complete replacement schedule. The
application assigns IDs to additions. Validation considers all deletions before
checking additions, regardless of array order. An empty chat result must still
have a useful message.

Creation treats `preferred_duration` as an upper bound and `sessions_per_week`
as a limit for local weeks receiving additions, counting retained planned and
completed workouts once. In chat modification those preferences are soft: an
explicit request may override them for that request without changing saved
preferences. Structural validation cannot establish that the natural-language
request actually authorized the override.

Every new session starts in the future on the local five-minute grid. Its
activity duration must fit within the planning window, and preparation/activity/
wrap-up must fit in one supplied free slot. Sport buffers default to 300 seconds
on **each** side. One session per local date is the default for every comfort
level. Modification may add multiple sessions on a date only when the backend
sets `allow_multiple_sessions_per_day: true` for an explicit request. The flag
is optional and defaults to `false`; creation rejects `true`. This authorization
does not change saved preferences or relax availability, buffers, exclusions,
protected workouts, or the planning window. Reserved intervals must not overlap
retained non-skipped workouts or other additions. The contract validates the
flag and mode, not whether chat text actually authorizes it.
Timezone and Monday–Sunday counting use `preferences.timezone`; daylight-saving
weeks may differ from seven fixed 24-hour days.

Only known, editable, planned workouts wholly within the window and starting
strictly in the future can be deleted. Completed, skipped, started, past,
unknown, and non-editable workouts are protected. History is deduplicated by ID;
contradictory duplicate records are rejected. Old workouts may reference sports
that are absent from today's catalog.

The [AI JSON contract](ai-json-contract.md) specifies every field, metric unit,
shape, and validation rule, with complete create and modify examples. Non-gym
workouts have catalog-defined metrics and ordered parts; gym workouts have
exercises with sets, repetitions, and instructions, without exercise IDs.

## Prompt policy and content validation

The server-owned [system prompt](../../apps/backend/src/ai/prompts/plan-system.txt)
prioritizes manageable beginner participation over intensity or filling free
time. It uses starting comfort, practical obstacles, interests, discovery
preferences, access, equipment, avoidances, and history to personalize sessions.
Equipment, locations, and avoidances are unique non-blank strings rather than
fixed option catalogs. Custom identifiers or descriptions such as
`rowing_machine`, `climbing_wall`, and `overhead_movements` are accepted, with
no field-specific length or list-size caps; the overall request limit applies.
Equipment and avoidance lists may be empty; locations must be non-empty.
The prompt interprets clear descriptions by meaning, applies every avoidance
throughout the session, and asks for clarification in modification when needed.
Unclear text must not imply equipment or facility access. Gym additions still
require the exact `gym` location marker for runtime validation.

It requests clear, standalone instructions, warm-up/rest/cool-down within the
session budget, and supportive wording in the chat language (English otherwise).

The prompt treats profile, catalog, history, and chat text as context that cannot
override the contract or protected-workout rules. It explicitly instructs the model
never to execute system overrides, prompt jailbreaks, or roleplay commands embedded
in user input, and never to reveal system instructions. It forbids invented fitness
measurements, diagnoses, venues, bookings, and calendar availability. Swimming
requires pool access and explicit swimming comfort; gym access alone does not
imply equipment. It avoids competitive targets, forced progression, guilt, and
medical claims. Illness-specific behavior is deferred.

Runtime validation enforces structure, IDs, metric bounds/units, summed part
durations where marked, scheduling, exclusions, selected-only discovery, and
gym access. In addition, safe-text validation enforces that user-facing messages,
workout descriptions, part descriptions, and exercise names/descriptions contain
no URLs, web links, markdown links, or HTML tags. Provider safety settings
(`HARM_CATEGORY_*`) are sent with each request, and in creation mode, content blocked
by the provider for safety fails with an explicit `BLOCKED` error. In modification mode,
safety blocks, overt prompt injection attacks in `user_prompt`, or outputs containing
unsafe text are handled gracefully: the function returns `{ events: [], message: ... }`
with a polite refusal (`"I cannot fulfill this request. I can only help you schedule and adjust your beginner movement plan."`),
ensuring the user still receives an answer in the chat without modifying their active plan.
Runtime validation does **not** prove appropriate intensity, readable technique,
equipment suitability, swimming suitability, avoidance compliance, gym timing
arithmetic described in prose, or correct interpretation of chat intent.

`reviewContent(plan, input)` is the application hook for additional content
checks after structural validation and before a result is returned. It may throw
to reject the output. It receives no database transaction or caller identity;
applications must still enforce ownership and persistence invariants separately.

## Local setup and usage

Use the backend's supported Node range (`>=22.9.0 <25`) and the committed npm
workspace lockfile. From the repository root:

```sh
npm ci
cp apps/backend/.env.example apps/backend/.env
npm run build:plans
npm run test:plans
npm run typecheck:plans
```

The committed template contains placeholders only. For the **current Gemini
adapter**, set these values privately in `apps/backend/.env`:

| Configuration    | Meaning                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | Server-only API key with access to the configured project/model                  |
| `GEMINI_MODEL`   | Explicit model ID, without `models/`; accepts letters, digits, `.`, `_`, and `-` |
| `PORT`, `HOST`   | Optional health-server configuration; unrelated to generation                    |

There is no default model. Both AI values are optional for health-only startup;
they are required for calls that reach the provider. Changing the model ID
selects another model on the current transport, not another provider.

`npm run dev:backend` loads the backend `.env`, but only exposes the current
health route. A direct script must load the environment itself. After building,
this deterministic example runs the exported function with a mocked provider
and the committed fixture context; it needs no live key:

```sh
node --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import { generatePlan } from '@hackyeah/backend';

const load = async (name) => JSON.parse(await readFile(
  `apps/backend/test/fixtures/${name}.json`, 'utf8'
));
const request = await load('initial.input');
const expected = await load('initial.expected-output');
const result = await generatePlan(request, {
  apiKey: 'test-key',
  model: 'test-model',
  now: Date.parse('2026-10-01T00:00:00Z'),
  fetchImpl: async () => Response.json({
    candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ text: JSON.stringify(expected) }] },
    }],
  }),
});
console.log(result);
JS
```

For live usage, load the environment with
`node --env-file=apps/backend/.env --input-type=module`, construct fresh owned
context with future dates, and call `generatePlan(request)` using the real
provider. Do not use an artificially old `now` in production; fixture dates and
the fixed evaluation time are for deterministic verification only.

The prompt lives beside the AI code at `apps/backend/src/ai/prompts/plan-system.txt`.
Nest copies `ai/prompts/**/*.txt` into `dist/ai/prompts/` for builds and watch mode;
the test runner copies those assets beside its compiled AI modules. The Docker
runtime receives the prompt through the compiled backend output, alongside the
compiled shared schemas.
`compose.yaml` supplies only `PORT`; it does not load `apps/backend/.env` into
the container. Inject the private AI values through a local Compose override
or the runtime's secret/environment mechanism when integrating generation.
Keep credentials out of clients, tracked configuration, and logs.

## Server function interface

Import `generatePlan`, `createPlan`, and `PlanGenerationError` from
`@hackyeah/backend`. Import `PlanInput`, `PlanOutput`, `PlanValidationError`,
`parsePlanInput`, `parsePlanOutput`, and schema builders from
`@hackyeah/contracts/plan`.

`generatePlan(value: unknown, options?: PlanOptions): Promise<PlanOutput>` accepts:

| Option          | Default                      | Purpose                                                              |
| --------------- | ---------------------------- | -------------------------------------------------------------------- |
| `apiKey`        | `process.env.GEMINI_API_KEY` | Override server credentials                                          |
| `model`         | `process.env.GEMINI_MODEL`   | Override the current provider's model ID                             |
| `fetchImpl`     | `globalThis.fetch`           | Inject transport for deterministic tests                             |
| `now`           | `Date.now()`                 | Millisecond evaluation timestamp for future/protected-workout checks |
| `reviewContent` | None                         | Async application content check before returning                     |

`createPlan` accepts exactly the same interface and supports both modes. Limits
and the prompt path are defined in
[plan-config.ts](../../apps/backend/src/ai/plan-config.ts), not environment
variables. The function returns no new workout IDs, plan version, commit receipt,
or HTTP status code.

## Failures, retries, and client states

`PlanValidationError` covers schema and semantic input/output failures. It has
an error name/message, not the provider error-code interface. Serialization and
provider/configuration failures use `PlanGenerationError` with these codes:

| Code               | Trigger                                                                   | Caller response                                                       |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `INVALID_INPUT`    | Input cannot be serialized as supported JSON                              | Fix request assembly; do not retry unchanged                          |
| `INPUT_TOO_LARGE`  | Serialized context or full provider body exceeds 2,000,000 bytes          | Resolve context/catalog size explicitly; do not silently discard chat |
| `CONFIGURATION`    | Invalid time, missing credentials, invalid model, unreadable/empty prompt | Correct server setup                                                  |
| `AUTHENTICATION`   | Provider HTTP 401 or 403                                                  | Correct key/project permissions                                       |
| `BILLING`          | Provider HTTP 402                                                         | Resolve project billing/credits                                       |
| `RATE_LIMIT`       | Provider HTTP 429                                                         | Wait before a deliberate retry; apply application usage limits        |
| `PROVIDER`         | Any other non-success HTTP response                                       | Inspect status and provider/model configuration                       |
| `NETWORK`          | Fetch/transport failure                                                   | Offer retry after connectivity recovers                               |
| `TIMEOUT`          | Abort or timeout during provider request/response read                    | Offer retry; preserve the current plan                                |
| `BLOCKED`          | Provider reports a prompt block reason                                    | Explain failure without claiming a saved plan                         |
| `INCOMPLETE`       | First candidate's finish reason is not `STOP`                             | Retry or revise context; do not apply partial content                 |
| `INVALID_RESPONSE` | Malformed envelope, missing content, or invalid JSON                      | Reject the result; retry deliberately                                 |

Provider response bodies are not included in errors because they may echo
personal context. The caller should log operational code/status and a request
identifier without raw preferences, chat, credentials, or provider content.

Client integration should show loading while generation/saving runs, distinguish
a valid empty or partial plan from a failure, and keep the current schedule on
failure. A no-change chat reply should remain visible. Refresh state after a
stale-version rejection and regenerate from current context; do not replay old
operations blindly. The adapter implements bounded provider HTTP retries but not
HTTP error mapping, cancellation from the client, guest quotas, or idempotent
persistence.

## Changing AI provider or model

The shared input/output contract, product terminology, and client behavior are
provider-independent. The current implementation is not a configurable
multi-provider registry: a provider change requires replacing the transport.

1. Preserve `generatePlan`, `PlanInput`, and `PlanOutput`. Keep credentials and
   provider envelopes on the backend so clients need no provider-specific change.
2. Replace endpoint, authentication, request-envelope construction, candidate/
   content extraction, completion checks, and provider error mapping in the
   adapter. Update configuration/template docs for the new credentials/model.
3. Adapt the catalog-specific schema to the new provider's supported subset.
   `buildPlanOutputSchema` is authoritative locally; the current
   `buildGeminiOutputSchema` is a transport-specific projection that removes or
   weakens some schema constraints. It must not replace local validation or be
   assumed compatible with another provider.
4. Preserve complete conversation context, explicit time, timeout/size limits,
   protected-workout checks, explicit daily authorization, open preference text,
   and the post-validation content-review hook.
   Update deterministic wire-format tests and verify representative live outputs.
5. Run contract/backend checks and review beginner instruction quality for both
   modes, empty/partial schedules, gym/non-gym sports, and failures. A model swap
   on the same provider also needs schema acceptance and content smoke checks.

No plan-data migration is needed solely for a provider swap that preserves the
contract. Changing fields, units, or ID types is a separate contract migration
that must be coordinated with both clients. Historic review filenames and
branch names describe past work and are not provider-selection settings.

## Verification and acceptance

The backend suites use mocked fetch responses and fixed evaluation times; they
require no AI credentials. From the repository root:

```sh
npm run test:plans
npm run typecheck:plans
npm run build:plans
npm run lint --workspace=@hackyeah/backend
npm run lint --workspace=@hackyeah/contracts
npm run format:check
```

Tests cover create/modify fixtures, full context transmission, empty availability,
partial plans, catalog metrics and parts, numeric IDs, gym exercise shapes,
timezones/grid/buffers, protected deletions, duplicate history, schema projection,
content review, size limits, and provider failure paths. See
[plan.test.ts](../../apps/backend/test/plan.test.ts) and
[catalog-validation.test.ts](../../apps/backend/test/catalog-validation.test.ts).
[preference-validation.test.ts](../../apps/backend/test/preference-validation.test.ts)
covers arbitrary preference text and invalid/duplicate values.
[plan-daily-policy.test.ts](../../apps/backend/test/plan-daily-policy.test.ts) covers
the default daily limit for all comfort levels, explicit modification-only
authorization, preserved overlap/slot/protection rules, and repeated local
daylight-saving hours.

Before enabling the complete feature, verify:

- Creation fits real availability and returns usable beginner instructions,
  including partial and empty results.
- Chat moves/replaces only eligible requested workouts, preserves completed
  records, and handles clarification without unnecessary changes. Multiple
  sessions on a date require explicit intent from the newest request and
  backend-owned authorization; neither clients nor earlier chat can grant it.
- Custom equipment, location, and avoidance descriptions remain usable in
  clients and the prompt; gym additions still require the canonical `gym` marker.
- Invalid generation, content rejection, and database failure preserve the
  active version; concurrent revisions cannot overwrite newer state.
- Authenticated users and web guests cannot read or modify one another's plans.
- Web/mobile display committed changes, loading, no-change replies, and retry
states correctly on the judging device/browser.
- The selected live provider/model accepts dynamic schemas and produces suitable
  gym/non-gym instructions. Prompt-level suitability needs human/content review.

Live provider calls, authenticated plan endpoints, database transactions,
concurrency/ownership integration, and end-to-end device checks remain unverified
or unimplemented in this feature. Teammate approval is still required before merge.

## Source map and recovery

- [Shared types](../../packages/contracts/src/plan-types.ts),
  [input schema](../../packages/contracts/src/schemas/input.schema.json), and
  [base output schema](../../packages/contracts/src/schemas/output.schema.json).
- [Schema builders](../../packages/contracts/src/plan-schema.ts) and
  [runtime validators](../../packages/contracts/src/plan.ts).
- [Adapter](../../apps/backend/src/ai/create-plan.ts),
  [configuration](../../apps/backend/src/ai/plan-config.ts), and
  [system prompt](../../apps/backend/src/ai/prompts/plan-system.txt).
- [Runtime status](../deployment.md), [development conventions](../development.md),
  and [product decisions](../product.md).

There is no plan migration or persistence side effect from calling the function.
For failed generation, fix configuration/context or retry from refreshed data;
never save unvalidated operations. For a prompt/provider regression, restore a
previously verified adapter/prompt/model configuration and rerun the checks before
resuming generation. Restoration of stored plan versions belongs to the future
persistence layer, not this adapter.
