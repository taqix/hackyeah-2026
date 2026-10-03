# Feature: Mobile app on Supabase (real API)

Status: in progress
Owner: mobile + Supabase/API
Issue/PR: pending (branch `feat/mobile-full-integration`)

## Problem and user outcome

The Expo app (`apps/mobile`) runs every screen against an in-memory mock
(`src/api/mock`). The Supabase product API (`supabase/functions/product-api`,
contract in [the frontend handoff](../api/FRONTEND_HANDOFF.md)) exists, but no
client uses it. Its AI adapter is disconnected and no sport catalog is seeded. A
person must be able to sign in for real, finish onboarding, get an AI plan built
from their answers and free calendar time, log sessions with feedback, change
the plan in chat, and see their history. All of this must persist in Supabase.

## Scope

- Included:
  - Supabase Auth on mobile:
    - email/password sign-in and sign-up, including the email-confirmation state
    - Google OAuth (PKCE through the system browser)
    - password reset email, plus an in-app new-password screen from the recovery link
    - session refresh and sign-out
  - An HTTP `ApiClient` that maps the product API onto the existing mobile
    interface. Screens keep using `src/api/hooks`.
  - A Gemini `PlanGenerator` in the Edge Function for generation and chat.
  - Server extensions the design needs:
    - feedback can be saved after the log and changed later
    - "choose again" opinions with reset
    - Undo of the latest chat change
  - A seed migration: the sport catalog, and profile backfill for older accounts.
  - Calendar:
    - device free time feeds generation and chat, with manual availability as the fallback
    - an opt-in export of planned sessions to a "Movo" device calendar
  - The mock stays behind `EXPO_PUBLIC_API_MODE=mock` for offline demos and
    tests. The default is Supabase. Demo controls and time travel only exist in
    mock mode.
- Deferred (kept unreachable or hidden, never shown as working):
  - extra workouts outside the plan, including chat-logged workouts (8.16)
  - persisted skipped/started states
  - the assistant summary (You 9–9.3; the card stays hidden)
  - editing saved completion actuals
  - timed gym sets
  - boolean/enum metrics
  - account deletion and export
  - Google Calendar as a second source
- Affected areas: mobile, Edge Function, database migrations, shared contracts.

## Acceptance criteria

- [ ] **New account.** Welcome → password (create) → onboarding → Review →
      Build plan → Today shows the first AI week.
- [ ] **Existing account.** Signs in with its saved plan, completions and chat.
- [ ] **Log a session.** Log or start a session (typed, file-filled, or gym set
      by set), then give feedback.
  - Closing feedback still saves the log.
  - Feedback can be given or changed later.
  - A gym "fix sets" before feedback edits the local draft.
- [ ] **Chat change.**
  - A change applies immediately with a change card, built as a client diff of
    two versions.
  - The newest change has a working Undo.
  - Replies say "Plan unchanged".
  - 409 conflicts reload the plan; offline and transport retries reuse the
    same request ID.
- [ ] **AI unavailable.** With no Gemini key, generation and chat show a
      provider-pending state and do not retry automatically. Answers are kept.
- [ ] **Calendar access.**
  - With access, generation and chat send `device_calendar` free slots.
  - Without access, they send `manual` slots from the preferred window.
  - Exported sessions appear in the "Movo" calendar when export is on, and
    disappear when it is off.
- [ ] **Next week.** Plans the following week automatically from the last day
      of the planned week (Home focus).
- [ ] **Ownership.** One account never sees another account's data. Mobile has
      no guest entry.
- [ ] **Missing configuration.** A build without
      `EXPO_PUBLIC_SUPABASE_URL`/key shows a clear configuration screen and
      never falls back to the mock silently.

## Design and compatibility

### Configuration (mobile)

`apps/mobile/.env` is ignored; `apps/mobile/.env.example` is committed.

| Name | Required | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes (supabase mode) | `https://<ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes (supabase mode) | publishable or anon key, never service role |
| `EXPO_PUBLIC_PRODUCT_API_URL` | no | defaults to `${URL}/functions/v1/product-api` |
| `EXPO_PUBLIC_API_MODE` | no | `supabase` (default) or `mock` |

Auth redirect: `hackyeah2026://auth/callback` (app scheme) plus the Expo Go
`exp://…/--/auth/callback` URL in development, and the web origin on Expo web.
The owner allowlists these in Supabase Auth.

### Mobile architecture

- `src/api/index.ts` picks the backend:
  - `mock` mode uses `createMockApiClient()`
  - otherwise `createRemoteApiClient()`
  - missing configuration gives a client that rejects with `not_configured`,
    and the root layout shows a setup screen
- `src/api/remote/*`. Pure modules take injected dependencies (fetch, access
  token, storage, clock, availability), so Node tests run without React Native.
  - `http.ts`: the envelope and error normalization.
  - `wire.ts`: a mirror of the contract plus the extensions below.
  - `data.ts`: a cached loader for profile, sports, current plan, all history
    pages, all completion pages, opinions and chat, with in-flight dedupe and
    invalidation after writes.
  - `mappers.ts`.
  - One module per `ApiClient` section, composed in `remote/client.ts`.
  - `remote/default.ts` wires the real dependencies: the supabase-js client
    with AsyncStorage, `expo-crypto` UUIDs, and the calendar availability.
- **Sport IDs.** The app keeps slug IDs (`walking`, `strength`, …).
  - The adapter translates slug ↔ catalog decimal ID at the boundary, matching
    catalog `name` to the mock catalog names.
  - Unknown sports get `sport-<id>`.
  - Icons, tips and copy keyed by slug keep working.
- **Weeks.** Weeks are Monday–Sunday in `preferences.timezone`.
  - A week's snapshot is the highest version whose `plan.week_start` is that
    Monday; history is paged fully. Revisions are never counted twice.
  - Completions are joined by `activity_id`. A completion keeps its own
    `plan_version_id`.
  - Past planned sessions without a completion show as "not logged" (UI state
    only).
- **Plan state.**
  - `status`:
    - `none`: no current plan
    - `building`: while the client's generate request runs
    - `failed`: the last generate failed and no plan exists; in memory only
    - `ready`: a current plan exists
  - `first_week_start` is the oldest snapshot week. `planned_through` is the
    newest week's Sunday.
  - `recent_change` is the newest `plan_updated` assistant message newer than a
    locally stored "seen" marker.
- **First plan and next week.**
  - The first plan uses the current Monday, with availability from now to Sunday.
  - Home generates the next Monday's week once today ≥ `planned_through`. It
    runs once per week per app session and shows a soft error.
- **Answers.** Profile › Edit saves the full preferences document. When
  planning fields change, it regenerates the active week (`generate`, same
  `week_start`, `expected_version` = active). Completed and past activities
  stay.
- **Logs.** `logs.create` stores a local draft (AsyncStorage) and returns
  `draft:<uuid>`. Home shows it as done at once.
  - `update` edits the draft.
  - `saveFeedback(draft)` sends `POST /completions` with the feedback.
  - `commit(draft)` (new `ApiClient` method, called when feedback is closed)
    sends `POST /completions` with `feedback: null`.
  - Pending drafts are flushed at the next signed-in start.
  - `saveFeedback(completionId)` uses `PUT /completions/feedback`.
  - A saved completion's actuals are read-only; the edit entry points are hidden.
- **Chat.**
  - `send` captures availability for the active week and uses one `request_id`
    per user action, reused for transport retries.
  - Change cards come from diffing the new version against the previous one by
    activity id.
  - `can_undo` holds only for the newest change whose version is still active
    and whose changed sessions have no completion.
  - Undo calls `POST /plans/undo`.
  - Quick replies are empty.
- **Errors (product API → mobile code).**

  | Product API | Mobile code |
  | --- | --- |
  | 400, 405, 413 | `validation` |
  | 401 | `unauthorized` (refresh, else sign out) |
  | 404 | `not_found` |
  | `VERSION_CONFLICT` | `stale_version` |
  | other 409s | `conflict` |
  | 501 `AI_NOT_CONFIGURED` | new `ai_unavailable`, not retryable |
  | 502, 503 AI | `generation_failed` |
  | other 5xx | `unknown` |
  | fetch failure | `offline` |
  | abort | `timeout` |

  New codes: `ai_unavailable`, `confirmation_required`, `not_configured`.
- **Calendar.** `src/services/calendar/plan-availability.ts`
  `captureAvailability({weekStart, from, window, minMinutes})`:
  - **Access granted:** free slots are intersected with the daily window
    (`preferred_window ?? [7,21]`) and split per day. Short slots are dropped,
    at most 100 are kept, `source: device_calendar`. The "Movo" export calendar
    is excluded from the read.
  - **Denied or unavailable (Expo Go, web):** `manual` slots from the window.
  - **`native-error`:** propagates.
  - **Export:** `plan-export.ts` `syncPlanToCalendar` upserts events by a
    `movo-activity:<uuid>` marker in the notes and removes stale ones. It is
    off by default. The toggle is on Data and privacy, stored locally.

### Contract extensions

These are additive; `contract_version` stays `"1"`. They live in
`packages/contracts/src/product.ts` and are regenerated into `docs/api`. The
router has exact paths only.

| Method | Path | Body / query | Response data |
| --- | --- | --- | --- |
| POST | /completions | `feedback` is now `Feedback \| null` | `ActivityCompletionEntity` (`feedback` nullable) |
| PUT | /completions/feedback | `{completion_id: uuid, feedback: Feedback}` | `ActivityCompletionEntity` |
| GET | /opinions | none | `ActivityOpinionEntity[]`, newest `updated_at` first |
| PUT | /opinions | `{activity_key, title, sport_id, opinion: yes\|maybe\|no\|null, last_date}` | `ActivityOpinionEntity \| null` (null = cleared) |
| POST | /opinions/reset | `{}` | `{cleared: integer}` |
| POST | /plans/undo | `{request_id, plan_id, expected_version}` | `{plan, version}` (new version, `origin: "undo"`) |

**`ActivityOpinionEntity`:**
- `activity_key`: 1–100 characters, `^[a-z0-9][a-z0-9_-]*$`
- `title`: 1–200
- `sport_id`: decimal string
- `opinion`: `yes|maybe|no`
- `last_date`: `YYYY-MM-DD`
- `updated_at`: timestamptz

**`PlanVersionEntity.origin`:** `generate|revise|undo`.

**Undo rules:**
- The active version must have origin `revise`; otherwise 409 `NOTHING_TO_UNDO`.
- It restores the immediately preceding version of the same week.
- Activities completed in the active version are kept verbatim.
- If a completed activity differs between the two versions, it returns 409
  `UNDO_LOCKED`.
- Idempotent by `request_id`.

**Seed migration:**
- The working sports are named exactly as in `apps/mobile/src/api/mock/catalog.ts`:
  Walking, Strength (gym), Running, Cycling, Swimming, Mobility and Football.
  They have `generation_enabled = true`.
- Duration metric: `duration_minutes` (`Time`, `min`, number, required, minimum 1).
- The mock's preview sports are inserted with `generation_enabled = false`.
- It is an idempotent upsert by case-insensitive name, never by fixed ID.
- Profiles are backfilled for `auth.users` that have no profile row.

### AI

- **Wiring.** `supabase/functions/product-api/gemini.ts` provides
  `createGeminiGenerator({apiKey, model}, fetcher)`. It is wired when
  `GEMINI_API_KEY` and `GEMINI_MODEL` are set; otherwise
  `unavailableGenerator` (501) stays.
- **Request.** It uses JSON-schema structured output and the retry with backoff
  from `apps/backend/src/ai` and `origin/codex/gemini-retries`.
- **Post-processing.**
  - The adapter sets `week_start` and `timezone` itself.
  - It keeps known activity IDs and mints new UUIDs.
  - It re-inserts completed and past activities verbatim.
  - Gym exercises use the exercise IDs of the mock `EXERCISES` library, so the
    app can enrich them.
- **Validation.** It skips the slot and window checks for activities that are
  JSON-identical to the previous version of the same week. That makes
  mid-week revisions possible.

### Open decisions and dependencies (owner)

- Before anything runs live, the owner must:
  - apply the migrations
  - deploy `product-api`
  - set the `GEMINI_API_KEY`/`GEMINI_MODEL` secrets
  - configure the Google provider and allowlist the redirect URLs
- Whether `lookupEmail` may reveal account existence is still open. Mobile
  asks for a password first and offers "Create an account" instead; there is
  no enumeration.

## Implementation plan

1. **Foundation (mobile).**
   - dependencies, config, supabase client, `remote/` scaffold, `http`, `wire`,
     `data`, `mappers`, slug mapping
   - type changes (`BuildPlanInput`, `logs.commit`, error codes)
   - the stub `captureAvailability`
   - mock-mode gating of Demo controls and time travel
   - the setup screen and the `AuthSessionSync` mount
2. **Backend AI**, in parallel: Gemini adapter, prompt, tests, the validation fix.
3. **Backend extensions**, in parallel: contract, migrations, store, handler,
   tests, regenerated docs.
4. **Mobile domains**, in parallel after step 1:
   - auth
   - plan, catalog and preferences
   - logs, profile and account
   - chat
   - calendar (availability and export)
5. **Integration.** Merge into `feat/mobile-full-integration`, run all checks,
   update the docs.
6. **Brief review and fixes.**

## Verification

To be filled in with exact commands and results as steps land. Planned:
- **Mobile:**
  - `npm run typecheck`, `lint`, `test`, `test:calendar`, `test:activity-import`
  - the new remote adapter tests
  - `npx expo export` for iOS, Android and web
- **Supabase:** `npm run test:supabase`, `typecheck:supabase`, `lint:supabase`
  and `schema:product` (no diff afterwards).
- **Not possible here:**
  - hosted Supabase: no credentials, CLI, Docker or Deno on this machine
  - a live Gemini key
  - a native calendar on a device

## Local runtime and recovery

- Copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill in the values.
  `EXPO_PUBLIC_API_MODE=mock` runs the old demo offline.
- Migrations are forward-only. Recovery is a new forward migration.

## Review and documentation

- [ ] Acceptance criteria verified and evidence attached to the PR.
- [ ] Required checks pass and one teammate approves.
- [ ] Affected product/development/runtime docs updated.
- [ ] Secrets and personal data excluded from committed examples and logs.
- [ ] Known limitations and follow-up work recorded.
