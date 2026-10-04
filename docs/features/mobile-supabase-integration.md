# Feature: Mobile app on Supabase (real API)

Status: ready for review
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
    - email/password sign-in and sign-up, including the email-confirmation state;
      sign-up also asks for the name the app greets the person by
      (see [Name](#mobile-architecture))
    - Google OAuth (PKCE through the system browser; a full-page redirect on
      the web), see [Google sign-in](#google-sign-in)
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
    - opt-in [Google Calendar](#google-calendar) on Data and privacy and on
      onboarding Review: its free/busy comes first for planning, and the
      export can go to a "Movo" calendar in Google instead of the device
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
- [ ] **Google sign-in.** Continue with Google works in a development build
      (`hackyeah2026://`), in Expo Go started with a hostname
      (`exp://<ip>.nip.io:8081/--/auth/callback` from `npm run start:hostname`,
      or a tunnel) and on Expo web (`http://localhost:8081/auth/callback`).
      Google shows its account chooser, the app greets the person by their
      Google name, and closing or declining Google stays on Welcome without an
      error. Expo Go on a raw IP address says how to start the app instead of
      opening Google (see [Expo Go and IP addresses](#expo-go-and-ip-addresses)).
- [ ] **Google Calendar.**
  - Connect on Data and privacy, or on onboarding Review, asks Google for
    free/busy and app-created calendars only, and shows the Google email once
    connected. Review offers it first to someone who signed in with Google,
    and Build plan never waits for it.
  - Connected with Use for planning on, generation and chat send
    `google_calendar` free slots. A failed Google read falls back to the device
    calendar, then to manual slots.
  - Add sessions to Google Calendar keeps a "Movo" calendar in Google in step
    with the plan.
  - When Google refuses the connection, or the token cannot be refreshed, the
    row says "Reconnect Google Calendar".
  - Disconnect deletes the tokens on the phone and can remove the Movo calendar
    from Google.
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
The app builds them with `Linking.createURL('auth/callback')`. The owner
allowlists these in Supabase Auth (done on the hosted project). Google
Calendar uses the same callback; its setup is in
[Google Cloud and Supabase setup](#google-cloud-and-supabase-setup-owner).
Expo Go's link only works with a hostname, never a raw IP address; see
[Expo Go and IP addresses](#expo-go-and-ip-addresses).

### Mobile architecture

- `src/api/index.ts` picks the backend:
  - `mock` mode uses `createMockApiClient()`
  - otherwise `createRemoteApiClient()`
  - missing configuration gives a client that rejects with `not_configured`,
    and the root layout shows a setup screen
- `src/api/remote/*`. Pure modules take injected dependencies (fetch, access
  token, storage, clock, availability), so Node tests run without React Native.
  - `http.ts`: the envelope and error normalization.
  - `wire.ts`: a mirror of the contract, extensions included.
    `tests/remote/contract-compat.test.ts` fails typecheck when it drifts from
    the contract source, and parses the adapter's real request bodies with the
    contract's schemas.
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
- **Name.** Today's greeting and the You tab read `AuthSession.user.name`.
  - Sign-up asks for it ("Your name", required, trimmed, 1–50 characters) and
    sends it as Auth metadata (`signUp` `options.data` `{name, full_name}`), so
    the first session carries it. Google keeps its own name.
  - The session name is the metadata's `full_name` or `name`. Without one
    (older accounts), `getSession` and email sign-in fall back to the
    profile's `username`. Auth events keep a name already shown for the same
    user.
  - `PUT /profile` needs the whole answers document (`preferences` is not
    nullable), so sign-up writes no profile. `preferences.save` sends
    `username = profile username ?? session name ?? null`, so the first
    onboarding save stores it. Google's `full_name` (else `name`) is the
    session name of a Google account.
  - A username the server already holds (for example one copied from the
    metadata at sign-up) is always sent back as it is, so no save replaces
    it, or sets it to null. Only a missing or blank username takes the
    session name. Both are trimmed and cut to the contract's 200 characters
    (`asUsername`, `lib/person-name.ts`) rather than dropped. Switching a sport
    off keeps the username the same way.
  - Settings › Account › Name changes it (`account.updateName`): `PUT /profile`
    with the new username and the current answers (skipped before
    onboarding), then `updateUser({data: {name, full_name}})`. An empty or
    too long name is rejected with `validation`.
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
  - A draft is saved against the newest version that has its session, not the
    one it was logged from. A change made before the save may have moved it.
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
  `captureAvailability({weekStart, from, window, minMinutes, timeZone}, {google})`:
  - **Google Calendar connected, Use for planning on:** Google's free/busy for
    the primary calendar, turned into free time and cut exactly like the
    device's below, `source: google_calendar`. If the read fails (expired and
    not refreshable, offline, a Google error), it falls back to the device,
    then manual. A failed read never goes out as an empty Google result.
  - **Access granted:** free slots are intersected with the daily window
    (`preferred_window ?? [7,21]`) and split per day. Short slots are dropped,
    at most 100 are kept, `source: device_calendar`. The "Movo" export calendar
    is excluded from the read.
  - **Denied or unavailable (Expo Go, web):** `manual` slots from the window.
  - **`native-error`:** propagates.
  - **Export:** `plan-export.ts` `syncPlanToCalendar` upserts events by a
    `movo-activity:<uuid>` marker in the notes and removes stale ones. It is
    off by default. The toggle is on Data and privacy, stored locally. The
    export can go to Google Calendar instead (see below).

### Google sign-in

`auth.signInWithGoogle` (`src/api/remote/auth.ts`):

- `signInWithOAuth({provider: 'google'})` with
  `redirectTo = Linking.createURL('auth/callback')` and
  `queryParams: {prompt: 'select_account'}`, so Google shows its account
  chooser.
  - Development build: `hackyeah2026://auth/callback`.
  - Expo Go: `exp://<host>:8081/--/auth/callback`, where `<host>` must be a
    hostname (see below).
  - Expo web: `http://localhost:8081/auth/callback`.
- **Phone:** `skipBrowserRedirect`, then `WebBrowser.openAuthSessionAsync`.
  - The code is read from the query or the fragment.
  - `exchangeCodeForSession` runs once per code. The sheet, the deep link
    listener (`AuthSessionSync`) and `/auth/callback` share one exchange.
  - Closing the sheet, or `access_denied` without an `error_code` (the person
    declined on Google), is a quiet cancel: Welcome stays as it was.
  - Supabase's own refusals come with an `error_code` and keep their copy, for
    example `signup_disabled` ("New accounts can't be created right now").
  - A refused or expired code reads "Google sign-in didn't finish. Try again."
- **Web:** a full-page redirect. `/auth/callback` finishes it after the page
  loads again; supabase-js (`detectSessionInUrl`) may trade the code first,
  and its saved session then counts.
- The button shows only while `GET /auth/v1/settings` reports
  `external.google: true`. It is offered anyway when the settings can't be read.
- The session's name is Google's `full_name` or `name`, and `AuthSessionSync`
  keeps the cached session in step.
- **Same email.** Supabase links a Google sign-in whose verified email matches
  an existing email account to that account automatically (automatic identity
  linking). The person lands in their existing account, which from then on has
  both identities. Google's name may replace the metadata name at that sign-in.

#### Expo Go and IP addresses

A plain `expo start` serves Expo Go on the computer's LAN IP, so
`Linking.createURL` gives `exp://10.0.0.5:8081/--/auth/callback`. Supabase
Auth refuses any redirect whose host is a raw IP address, even one written
out exactly in the allowlist. It sends Google's answer to the Site URL
(`http://localhost:3000`) instead, and the phone shows "This site can't be
reached". The same link with a hostname matches the existing
`exp://**/--/auth/callback` entry, so:

- **`npm run start:hostname`** (in `apps/mobile`, or at the repository root)
  runs `expo start` with `REACT_NATIVE_PACKAGER_HOSTNAME=<LAN IP>.nip.io`
  (`scripts/start-hostname.cjs`; it prefers `en0`, then `en1`, and skips
  internal and link-local addresses). Public DNS resolves `10.0.0.5.nip.io`
  back to `10.0.0.5`, so the phone still loads from the Mac, and the link
  becomes `exp://10.0.0.5.nip.io:8081/--/auth/callback`. Extra arguments go
  to `expo start` (`npm run start:hostname -- --clear`). A router with DNS
  rebinding protection may refuse such answers; then use one of the next two.
- **`npx expo start --tunnel`** gives `exp://<id>-anonymous-8081.exp.direct/--/…`.
- **The development build** uses `hackyeah2026://auth/callback`, which never
  depends on the host.

Before opening Google, `signInWithGoogle` and the Google Calendar connect
check the redirect (`api/remote/expo-go-redirect.ts`). An `exp://` or
`exps://` link whose host is an IPv4 or IPv6 literal rejects with
`ExpoGoIpRedirectError` (code `validation`, not retryable): "Google sign-in
can't return to Expo Go on an IP address. Start the app with npm run
start:hostname, use --tunnel, or use the dev build." Welcome shows it without
Try again; the Google Calendar rows show their own wording of it. Email
confirmation and password reset links from Expo Go on an IP land on the Site
URL the same way; they are not checked.

### Google Calendar

Opt-in, on Data and privacy (`features/settings/google-calendar-rows.tsx`)
and on onboarding Review (`features/onboarding/review/calendar-rows.tsx`).
Both use one hook, `useGoogleCalendarConnect(from)`
(`features/google-calendar`): whether to offer it, the connection, and
Connect. The app calls Google Calendar directly with the person's Google
token.

**Reads and writes**

- It reads free/busy only, never event titles or details.
- It writes only to a "Movo" calendar that it creates itself.
- The scopes are in one constant (`GOOGLE_CALENDAR_SCOPES`,
  `services/google-calendar/types.ts`):
  - `https://www.googleapis.com/auth/calendar.freebusy`
  - `https://www.googleapis.com/auth/calendar.app.created`

**Connect** (`api/remote/google-calendar.ts`, `connect`)

- If the account already has a Google identity (`getUserIdentities`), it runs
  `signInWithOAuth` with:
  - `{redirectTo, scopes, queryParams: {access_type: 'offline', prompt: 'consent', login_hint: <its Google email>}, skipBrowserRedirect}`
  - The browser flow is the same as Google sign-in.
- Otherwise (an email account) it runs `linkIdentity` with the same options.
  - This needs manual linking switched on in Supabase Auth.
  - Its `manual_linking_disabled` error reads "Connecting Google to an account
    made with email isn't switched on yet."
  - A Google account linked to another Movo account
    (`identity_already_exists`) gets its own message.
- After the code exchange, the session carries `provider_token` and
  `provider_refresh_token` once. Supabase does not keep them.
- **Capture.** A pending marker in AsyncStorage holds:
  - the user
  - the start time
  - a fingerprint of any older Google token
  - for the `signInWithOAuth` path, the session to restore
  - the screen it started on (`from`: `privacy` or `review`)

  `capture(session)` stores the tokens for the user who tapped Connect. It
  runs from the connect call, the Android deep link (when the sheet reports a
  dismiss), and `AuthSessionSync` (the web page after Google). An older
  sign-in's token that comes back on a reload is never taken.
- **Another account.** If Google signs in a different Movo account, the
  original session is put back (`setSession`) and the row explains it.
- **Web.** The page goes to Google, and `/auth/callback` returns to the
  screen the connect started on (`returnTo()`: Data and privacy, or
  `/onboarding/review`). On Android the callback screen opens over that
  screen and goes back to it.
- **Expo Go on an IP address** rejects before anything else, as for Google
  sign-in: "Google Calendar can't return to Expo Go on an IP address. …".

**Tokens** (`services/google-calendar/tokens.ts`)

- Stored as `{access_token, expires_at, refresh_token, email, connected_at, needs_reconnect}`.
- Kept per Supabase user under `movo.google-calendar.tokens.v1.<user id>`:
  - native: `expo-secure-store` (keychain, keystore)
  - web, which has no secure store: AsyncStorage (localStorage), where
    supabase-js keeps its own session
- The choices are in AsyncStorage per user: Use for planning (on by default),
  Add sessions (off by default), and the Movo calendar ID.

**Refresh**

- The access token is assumed to last 50 minutes.
- Near expiry, or after a Google 401, the app sends `POST /google/token`
  `{refresh_token}` to the product API, which answers `{access_token, expires_in}`.
- The function holds the OAuth client secret.
- One refresh runs at a time per user.
- Any of these marks the tokens `needs_reconnect`:
  - `GOOGLE_RECONNECT_REQUIRED` (Google answered `invalid_grant`)
  - `GOOGLE_NOT_CONFIGURED` (no function secrets)
  - a missing route (404)
  - no refresh token
  - a refused scope

  The row then says "Reconnect Google Calendar", and planning skips Google
  until then. Offline is not a reason to reconnect.

**Availability.** Described in the Calendar bullet above.
- `POST https://www.googleapis.com/calendar/v3/freeBusy` asks for
  [range start, range end) on `primary`, in the plan's time zone.
- Busy intervals become free gaps (`freeFromBusy`). The existing per-day
  window, minimum length and 100-slot cap then apply.

**Export** (`services/google-calendar/export.ts`)

- `syncPlanToGoogleCalendar` finds or creates a secondary "Movo" calendar:
  - the remembered ID first
  - else one found by title and description (listing may be refused for
    these scopes)
  - else `calendars.insert`
- It upserts events by `extendedProperties.private.movoActivityId`.
- It deletes stale or duplicate Movo events in the synced range. Events
  without the property are left alone.
- A Movo calendar deleted in Google is created again.
- It shares the device export's queue (`features/calendar-export`): debounced
  1.5 s, one write at a time, retried on the next change or return to the
  app. Failures stay quiet.

**One target.** Sessions go to one Movo calendar:

- Turning on Add sessions to Google Calendar while the phone's export is on
  asks first.
- It then removes the phone's Movo calendar, and the reverse works the same
  way.
- Turning the Google export off asks, then deletes its Movo calendar.

**Disconnect**

- Optionally removes the Movo calendar from Google first.
- Asks Google to revoke the token (`oauth2.googleapis.com/revoke`, with the
  token in the form body).
- Deletes the tokens on the phone and turns the export off.

**Debug logs** (scope `calendar`)

- connect: the path and the outcome
- refresh
- free/busy: the busy and free counts, the slot count
- export: the created, updated and deleted counts

They never contain a token, an email or event content.

**UI** (Data and privacy › Connected)

- Not connected:
  - "Google Calendar"
  - "Busy times only, never what's in your events. It can also add your sessions."
  - Connect
- Connected:
  - the Google email with On
  - Use for planning
  - Add sessions to Google Calendar
  - Disconnect Google Calendar (a sheet: disconnect and remove the calendar,
    or keep it)
- Hidden in mock mode, while Google sign-in is off (`GET /auth/v1/settings`)
  and while signed out. The providers answer describes the project, so it is
  kept across sign-in and sign-out and read again at a cold start; when it
  can't be read, the row is offered.

**UI** (onboarding Review, the calendar step)

- Two rows: "Phone calendar" (the device's access, as before) and "Google
  Calendar". Without Google sign-in on the project, only the phone row, still
  labelled "Calendar".
- Someone who signed in with Google sees Google Calendar first: "Not
  connected", "You signed in with Google. We only read when you're busy, never
  what's in your events.", Connect. Others see it second, without the first
  sentence.
- Connected: the Google email, "Busy times only, never what's in your
  events.", a check. Reconnect, Try again and the connect's problems work as
  on Data and privacy. The choices and Disconnect stay on Data and privacy.
- Optional: Build plan never waits for it. Connected with Use for planning on
  (the default), the first plan uses Google's free/busy.
- **Web.** The page leaves for Google, so Review keeps the onboarding answers
  in the tab's sessionStorage just before (`stashDraftForRedirect`,
  `state/onboarding-draft.ts`). The draft starts from them when the page
  loads again, once, within 30 minutes; only option values the app still
  offers are restored. The stash is dropped when the page didn't leave.

### Google Cloud and Supabase setup (owner)

Google sign-in goes through Supabase's hosted OAuth, so the Google client is a
**Web application** client whose redirect URI points at Supabase.

1. **Google Cloud, OAuth client (Web application).**
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
   - No JavaScript origins are needed.
2. **Google Cloud, APIs.** Enable the **Google Calendar API** in the same
   project.
3. **Google Cloud, OAuth consent screen.**
   - App name `Movo`.
   - Authorized domain `<ref>.supabase.co`.
   - Scopes: `openid`, `email`, `profile`, and for Google Calendar
     `.../auth/calendar.freebusy` and `.../auth/calendar.app.created`.
   - While the app is unverified (publishing status "Testing"), add each tester
     under Test users. Only they can grant the calendar scopes, and their
     refresh tokens expire after 7 days. That shows as "Reconnect Google
     Calendar".
   - Publishing for everyone needs Google's verification of the calendar
     scopes.
4. **Supabase Auth › Providers › Google.**
   - On, with the Web client ID and secret. This is done on the hosted project.
   - The secret stays in Supabase, never in `.env` or Git.
5. **Supabase Auth, manual linking.** Turn on "Allow manual linking"
   (`security_manual_linking_enabled`). Otherwise an email account cannot
   connect Google Calendar.
6. **Function secrets.** Set the same Web client for the token refresh, then
   redeploy:

   ```sh
   supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<WEB_CLIENT_ID> GOOGLE_OAUTH_CLIENT_SECRET=<WEB_CLIENT_SECRET>
   supabase functions deploy product-api
   ```

   Without them, refresh answers 501. The app then asks for a reconnect when
   the first access token expires, after about an hour.
7. **Redirect allowlist.** Google Calendar uses the existing
   `auth/callback` URLs. Nothing new is needed.
8. **App.** Rebuild the development build: `expo-secure-store` is a native
   module. Expo Go already includes it.

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
| POST | /google/token | `{refresh_token}` (1–2048 characters) | `{access_token, expires_in}`; 501 `GOOGLE_NOT_CONFIGURED`, 409 `GOOGLE_RECONNECT_REQUIRED`, 502 `PROVIDER_UNAVAILABLE` |

**`availability.source`:** `device_calendar|google_calendar|manual`.
`google_calendar` is handled exactly like `device_calendar` by validation and
the Gemini adapter: only the slots matter.

**POST /google/token:**
- It calls `https://oauth2.googleapis.com/token` with the function secrets
  `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
- It is authenticated like every route, and never stores or logs a token.
- `invalid_grant` is 409, not 401, so it never reads as an expired Supabase
  session.

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

**Completed activities:** every plan save must keep each completed activity of
the active version exactly as that version has it. Otherwise the database
refuses the save, and the API answers 409 `VERSION_CONFLICT`. A completion
saved late against an older version locks only the active copy, so it cannot
freeze the week.

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
- **Validation.** It skips the per-activity checks (slot, window, sport and
  duration) for activities that are JSON-identical to the previous version of
  the same week. That makes mid-week revisions possible, and lets a same-week
  regeneration after an answers edit keep past sessions.

### Hosted project state (FitnessApp, after the push on 4 October 2026)

**Database**
- Applied migrations, recorded in `supabase_migrations.schema_migrations`:
  - `20261003130000` and `20261003140000` (already there)
  - `20261004100000_feedback_opinions_undo` (new)
  - `20261004110000_sport_catalog_seed` (new)
- The wearable migration `20261003120000` is still not applied, on purpose.
- The catalog has 22 sports: 7 working (Walking, Strength, Running, Cycling,
  Swimming, Mobility, Football) and 15 previews. Every public table has RLS
  enabled.
- Security advisors report two expected warnings: `complete_activity` and
  `update_completion_feedback` are `SECURITY DEFINER` RPCs callable by
  `authenticated`, and both derive the owner from `auth.uid()`.
  Leaked-password protection is off; it is a dashboard toggle.

**Function**
- `product-api` is redeployed with the Gemini adapter and the new routes, and
  `verify_jwt = true` is kept.
- The project signs user tokens with ES256. If the gateway ever rejects valid
  tokens, decide on `verify_jwt = false`. The handler verifies every token
  with Auth itself.
- Function secrets: `GEMINI_API_KEY` and `GEMINI_MODEL` (`gemini-3.8-flash`)
  are set, alongside the platform defaults (`SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, …).
- `gemini-3.8-flash` rejects `minItems`/`maxItems` in `responseJsonSchema`
  with a bare 400 INVALID_ARGUMENT. The adapter describes counts instead and
  enforces them locally.

**Auth**
- Email sign-in is on with autoconfirm.
- Google sign-in is on with a Web client ID and secret. `GET /auth/v1/settings`
  reports `external.google: true`, so the app shows the button.
- Manual identity linking (`security_manual_linking_enabled`) is off. Email
  accounts cannot connect Google Calendar until it is on.
- `product-api` has no `GOOGLE_OAUTH_*` secrets yet, and the Google token route
  is not deployed.
- The redirect allowlist holds `hackyeah2026://auth/{callback,reset}`,
  `exp://**/--/auth/{callback,reset}` and
  `http://localhost:8081/auth/{callback,reset}`. `site_url` is still
  `http://localhost:3000`.
- Auth refuses a redirect to a raw IP host even when it is allowlisted
  exactly, and falls back to `site_url`. Seen on 4 October with Expo Go on
  Android (`exp://<LAN IP>:8081/--/auth/callback`); the same link with a
  `nip.io` or `exp.direct` hostname is accepted. See
  [Expo Go and IP addresses](#expo-go-and-ip-addresses).

### Open decisions and dependencies (owner)

- Google Calendar, from
  [Google Cloud and Supabase setup](#google-cloud-and-supabase-setup-owner):
  - Already done on 4 October: manual linking turned on, and `product-api`
    redeployed with `POST /google/token`.
  - Still open:
    - the Calendar API
    - the consent screen scopes and test users
    - the two `GOOGLE_OAUTH_*` function secrets (the Management API shows only
      a digest of the Auth client secret, so it can't be copied over)
- Optional: enable leaked-password protection.
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

Run on 4 October 2026 on the merged branch, with no calls to the hosted
project or Gemini.

- **Mobile** (in `apps/mobile`):
  - `npm run typecheck` (app, tests, activity-import and tests/remote): 0 errors.
  - `npx eslint src`: clean.
  - `npm run test:remote`: 108 of 108 pass. They use fakes for fetch, Auth,
    storage and the calendar. This includes `contract-compat.test.ts`, which
    checks every wire DTO, entity and envelope against the contract both ways
    and parses the bodies the adapter sends on all eight write routes.
  - `npm test`: 10 of 10. `npm run test:calendar`: 62 of 62 in Europe/Warsaw
    and in America/Los_Angeles. `npm run test:activity-import`: 26 of 26.
  - `npx expo export --platform web`: bundles and renders 35 pages
    statically. `npx expo export --platform ios`: bundles. Android was not
    exported.
- **Supabase and contracts** (repository root):
  - `npm run test:supabase`: 43 of 43 pass, including the Gemini adapter
    against canned answers.
  - `npm run typecheck:supabase`, `npm run lint:supabase`,
    `npm run lint --workspace=@hackyeah/contracts` and
    `npm run format:wearables`: clean.
  - `npm run schema:product`: after a re-run, `git status docs/api` is clean.
- **Not verified here.** None of these was possible on this machine:
  - the hosted project: no CLI, Docker or Deno, and no calls by rule
  - a live Gemini key
  - a device or simulator run

  The acceptance criteria above are therefore covered only by unit tests with
  fakes.

### Google sign-in and Google Calendar (4 October, later)

Run in a worktree of `feat/mobile-full-integration`, with no calls to the
hosted project, Google or Gemini, and no real account. Google, Supabase Auth
and the product API are fakes.

- **Mobile** (in `apps/mobile`):
  - `npm run typecheck` and `npx eslint src`: clean.
  - `npm run test:remote`: 149 of 149. `tests/remote/google-calendar.test.ts`
    covers:
    - the connect choice (`signInWithOAuth` with `login_hint`, or
      `linkIdentity`) with the scopes and offline access
    - tokens in the secure store only, per user
    - the web redirect and capture, and an older sign-in's token being ignored
    - another account restored
    - decline, close, and the Android dismiss race
    - manual linking off, a Google account taken, offline
    - refresh through `POST /google/token`, with the body checked against the
      contract; reconnect on 409, 501 and 404; offline left alone
    - the planning and export switches, disconnect with revoke and calendar
      removal

    `auth.test.ts` adds `prompt=select_account`, the Expo Go callback with a
    fragment code, and the redirect error copy.
  - `npm test`: 10 of 10.
  - `npm run test:calendar`: 77 of 77 in Europe/Warsaw and in
    America/Los_Angeles. `tests/google-calendar.test.ts` runs against an
    in-memory Google Calendar API. It covers:
    - free/busy into free slots, including DST weeks and a fully busy week
    - the fallbacks to the device and manual, never an empty Google result
    - the 401 refresh and the scope errors
    - the token refresh, its dedupe and the reconnect marking
    - the export: create, idempotent second run, update, delete stale and
      duplicate, unmarked events kept, recreate after deletion, reuse after a
      reinstall, remove
  - `npx expo export --platform web` and `--platform ios`: bundle.
- **Supabase** (repository root):
  - `npm run test:supabase`: 49 of 49. `google-token.test.ts` runs the route
    against a fake Google token endpoint:
    - success, with the form body and nothing in the URL
    - missing secrets (501)
    - `invalid_grant` (409, logs without the token)
    - a rejected client, an outage, an odd answer
    - validation, 401 and 405
  - `npm run typecheck:supabase` and `npm run lint:supabase`: clean.
  - `npm run schema:product`: after a re-run, `git status docs/api` is clean.

### Expo Go hostnames, the username and Google Calendar on Review (4 October, evening)

Run in a worktree of `feat/mobile-full-integration`, with no calls to the
hosted project, Google or Gemini, and no real account.

- **Mobile** (in `apps/mobile`):
  - `npm run typecheck` and `npx eslint src`: clean.
  - `npm run test:remote`: 160 of 160.
    - `expo-go-redirect.test.ts`: IPv4 and IPv6 literals (bracketed, zoned,
      IPv4-mapped) against hostnames (`nip.io`, `exp.direct`, `localhost`);
      only `exp://` and `exps://` links on an IP are refused, never
      `hackyeah2026://` or `http://localhost:8081`.
    - `auth.test.ts`: Expo Go on an IP rejects before Supabase or the browser
      is asked, with the copy and no retry; `nip.io`, a tunnel and the dev
      build reach Google. The providers are read the same signed in, after
      sign-out and on a cold start, with the publishable key only.
    - `google-calendar.test.ts`: the connect refuses an IP before Google and
      leaves no pending marker; `nip.io` and a tunnel connect. A connect
      started on Review returns to Review after its marker is gone, and an
      older marker returns to Data and privacy.
    - `auth-name.test.ts`: a Google account's first save stores Google's
      `full_name`; a username the server filled in is kept on every save and
      sport switch, never replaced or nulled; a blank one takes the session
      name; a long one is cut to 200 characters, not dropped.
  - `npm test`: 13 of 13, including `start-hostname.test.mjs` (en0, then
    en1, then others; loopback, link-local and IPv6 skipped; none offline).
  - `npm run test:calendar`: 77 of 77 in Europe/Warsaw and in
    America/Los_Angeles. `npm run test:activity-import`: 26 of 26.
  - `npm run start:hostname -- --port 8097` (`CI=1`, `EXPO_OFFLINE=1`) served
    a manifest whose `hostUri` is `<LAN IP>.nip.io:8097`; it was stopped right
    after. From the repository root, `npm run start:hostname -- --help`
    reached `expo start --help`.
- **Not verified here:** the Review rows were not rendered. In this worktree,
  whose `node_modules` link to the main checkout, Metro finds no routes, so
  the web export and dev server show only Expo's default page. Expo Go on a
  phone, `nip.io` on the office network, and the web return to Review with
  the stashed answers are untested.

### Deviations from the plan

- **Validation** skips every per-activity check (sport, discovery, gym shape,
  duration, slot, window) for a session that is JSON-identical to the
  previous version of the same week, as it already did for completed
  sessions. The plan said only slot and window. Without this, regenerating a
  week after an answers edit would reject past sessions forever. The count
  limit and the completed-session lock still apply.
- **Chat change cards** show duration diffs in seconds, not minutes, because
  the change card and the mock read seconds.
- **Chat availability** starts at the later of now and the week's start.
- **Change card rows.** Sessions done before a change are not shown as rows.
  A session done after the change keeps its row and locks Undo.
- **Next week.** After a gap the trigger plans the current week, not only the
  next Monday.
- **`plan.build` with an existing plan** waits for the result (up to about
  two minutes) instead of returning `building`. It rejects on failure, and the
  plan stays as it was.
- **Failed preparation.** When a plan request cannot be prepared, the attempt
  is recorded as a failed build or a note. Causes are a calendar `native-error`,
  missing answers, or being offline while reading the profile. Empty free time
  is never sent in its place.
- **Logs.** Workouts outside the plan are rejected. Saved completions are
  read-only. If the opinions route is missing (404 or 405), the opinion
  inside `saveFeedback` is skipped without an error, because the completion
  and its feedback are already saved.

### Deferred and not verified

- **Hosted project (owner).** Steps are in [Runtime status](../deployment.md):
  - apply `20261004100000` and `20261004110000`
  - deploy `product-api`
  - set `GEMINI_API_KEY` and `GEMINI_MODEL`
  - allowlist the auth redirects
  - Google Calendar: see
    [Google Cloud and Supabase setup](#google-cloud-and-supabase-setup-owner)
- **Never run against real PostgREST:**
  - the opinion upsert (`on_conflict`, `Prefer: resolution=merge-duplicates`)
  - the `sport_id::text` cast in write responses
  - JSON `null` feedback arriving as SQL `NULL`
- **Live Gemini.** Not called yet:
  - The response JSON schema (nullable `anyOf`, enums, integer bounds,
    `date-time`) follows Google's docs but has not been checked against the
    real API.
  - No `thinkingConfig` is sent, and `maxOutputTokens` is 16384.
  - Deno bundling has not been checked.
- **Device-only behaviour.** Covered only by unit tests with fakes, or by
  typecheck and lint:
  - the Google round trip on iOS and Android
  - Android deep-link timing
  - web `detectSessionInUrl` on `/auth/callback` and `/auth/reset`
  - native calendar create, update and delete
  - the permission dialogs and the new permission text, which needs a native
    rebuild
  - Home's `PlanNote` and `BuildFailed`
  - the Calendar failed state
  - the empty-catalog note
  - the chat composer and send hook
- **Server edge cases:**
  - Undo and every plan save need `SUPABASE_SERVICE_ROLE_KEY`. The platform
    injects it; without it, Undo answers a misleading 501 `AI_NOT_CONFIGURED`.
  - If a week's completed and past sessions already exceed `sessions_per_week`,
    generation returns 400 without calling Gemini.
  - Retrying `POST /completions` with the same `request_id` after the feedback
    changed replays the original receipt, which has the old feedback.
- **Client edge cases:**
  - The chat and plan bodies kept for retries live in memory only. After a
    restart, Try again under the same `request_id` can get a
    `REQUEST_CONFLICT`.
  - A PKCE recovery link works only on the device that asked for it.
  - Without a "seen" marker on this device, `recent_change` shows only a
    change that made the active version.
  - The sign-in step reads "Sign in", not "Welcome back".
- **Name:**
  - A Google account's Auth metadata may be refreshed from Google at its next
    sign-in, which can replace a name changed in Settings. The profile keeps
    the new username.
  - Not checked on a device: the name field's autofill and the scroll that
    keeps the password field above the keyboard on small screens.
- **Calendar export:**
  - It runs only while the app is open.
  - Signing out keeps the Movo calendar.
  - With access revoked, the app cannot delete the Movo calendar.
- **Google Calendar, never run against Google or Supabase:**
  - Whether Supabase returns `provider_token` and `provider_refresh_token`
    after a PKCE `linkIdentity` exchange as it does after a sign-in. Without
    them, Connect says Google didn't share the calendar.
  - Whether `calendarList.list` is allowed with these scopes. The export
    creates a new Movo calendar when it is refused, so a reinstall can leave a
    second one.
  - Whether `calendars.delete` is allowed for the app's own calendar under
    `calendar.app.created`.
  - The Android dismiss race, the web return through `/auth/callback`, and the
    restore after another account signed in.
  - Google's consent screen with unticked calendar boxes. Expected: a 403
    reads as "Reconnect Google Calendar".
- **Google Calendar, by design:**
  - Google tokens stay on the phone for the account after sign-out, so the
    same account signing in again finds it connected. Disconnect removes them.
  - The access token's lifetime is assumed (50 minutes), because Supabase does
    not pass Google's.
  - Free/busy reads the primary calendar only.
  - Review offers Connect only; the choices and Disconnect are on Data and
    privacy.
- **Expo Go:**
  - `npm run start:hostname` relies on public DNS for `nip.io`. A network
    whose DNS rebinding protection drops private answers can't load the app
    that way; `--tunnel` or the dev build still work.
  - Email confirmation and password reset links from Expo Go on an IP still
    land on the Site URL; only the Google flows check the redirect.
- **Copy and mock leftovers:**
  - The reset-feedback sheet still mentions the assistant summary, which is
    hidden in Supabase mode.
  - In mock mode with the demo offline switch on, closing feedback shows the
    not-saved message.
  - The mock plans without calendar slots.
- **Kept in sync by hand:**
  - `supabase/functions/product-api/exercises.ts` mirrors the mobile
    `EXERCISES`.
  - The seed test imports the mobile mock catalog.
  - Gemini plans only rep-tracked gym exercises, because timed sets are
    deferred.

## Local runtime and recovery

- Copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill in the values.
  `EXPO_PUBLIC_API_MODE=mock` runs the old demo offline.
- Migrations are forward-only. Recovery is a new forward migration.

## Review and documentation

- [ ] Acceptance criteria verified and evidence attached to the PR.
- [ ] Required checks pass and one teammate approves.
- [x] Affected product/development/runtime docs updated.
- [x] Secrets and personal data excluded from committed examples and logs.
- [x] Known limitations and follow-up work recorded (Deferred and not verified).
