# Feature: Mobile app on a mocked API

Status: ready for review
Owner: mobile
Issue/PR: pending

## Problem and user outcome

The design in `design/` describes every mobile screen, but the NestJS application
API does not exist yet. The mobile app needs every screen, component and
navigation path working now, so the team can demo and test the journey locally
and later swap in the real API without rewriting screens.

## Scope

- Included: the design system as a typed theme and UI kit; every screen of the
  design (sign in, onboarding 2–4, Today 5–5.13, workouts and logging 6–6.10,
  feedback 7, chat 8–8.16, You 9–9.7, Calendar 10–10.1); navigation with the
  floating tab bar and the chat button; an in-memory mock backend with a demo
  persona, a rule-based planner and coach, and demo switches for failure states.
- Deferred: the real API client, Supabase Auth, a real AI planner and coach,
  lock-screen gym timers (Live Activity / ongoing notification), push
  notifications, account deletion and data export.
- Affected areas: mobile only. No backend, database or shared-contract changes.

## Acceptance criteria

- [ ] A new account goes Welcome → onboarding 2–3.4 → Review → Build plan →
      Today, which shows the building state and then the first week.
- [ ] `ana@example.com` signs in to three weeks of history: done, skipped and
      upcoming sessions, an extra workout, chat changes and plan versions.
- [ ] A session can be started or logged (typed or from a `.fit`/`.gpx` file),
      followed by feedback; gym sessions are tracked set by set.
- [ ] A chat request applies straight away with a change card and Undo; replies
      say "Plan unchanged"; failures, stale results and offline keep the plan.
- [ ] Loading, empty, error and retry states are reachable through Demo controls.
- [ ] Data survives an app reload (the mock persists to AsyncStorage).
- [ ] Guest behavior: not applicable on mobile (no guest entry).

## Design and compatibility

- API contract: `apps/mobile/src/api/types.ts` and `client.ts`. Shapes that
  exist in the plan exchange (`codex/gemini-plan-contract`) keep its field
  names; everything the design needs beyond it is marked "Proposal" there and
  must be agreed with the backend before moving to `packages/contracts`.
- Swapping the backend: screens use only the hooks in `src/api/hooks`. Replace
  `createMockApiClient()` in `src/api/index.ts` with an HTTP client that
  implements `ApiClient`; hooks, query keys and screens stay as they are.
- The mock lives in `src/api/mock`: `catalog.ts` (sports and metrics),
  `planner.ts` (weekly plans from the answers), `coach.ts` (the chat rules from
  `design/prototype/chat.jsx`), `summary.ts`, `seed.ts` (the demo persona),
  `db.ts` (persisted state) and `demo.ts` (switches).
- Chat placement follows the design decision on `develop` (1e4c8e4): a round
  button beside the tab bar opens chat full screen; there is no Chat tab.
- Open decisions: everything listed under "Not decided yet" in
  `design/README.md`, notably the change card and Undo contract, log and gym
  set shapes, the assistant summary, and per-session "choose again" feedback.

## Implementation plan

1. Theme tokens, `Text`, `Icon`, the API contract and entry points.
2. UI kit (`src/components/ui`, `src/components/layout`, gallery at `/dev/kit`),
   data layer and mock backend (`src/api`, `src/lib`, `src/state`), app shell
   and navigation (`src/app`, `src/navigation`).
3. One flow per feature folder under `src/features`, each replacing its
   placeholder routes.

## Verification

Run from `apps/mobile` on 3 October 2026, Node 24.21:

- `npx tsc --noEmit -p tsconfig.json` and `-p tests/tsconfig.json`: 0 errors.
- `npx eslint src`: clean.
- `npx tsx --test tests/mock-backend.test.ts` (planner, coach changes, undo,
  chat workouts): 10 of 10 pass. Existing suites still pass: `npm test` (step
  counter, 10), `npm run test:calendar` (45), `npm run test:activity-import` (26).
- `npx expo export --platform ios` and `--platform android`: both bundle.
- Expo web at 375 pt: a new account (Continue with Google) through every
  onboarding step, sport search, Review, Build plan, the building state and the
  first week; paging to next week; opening a session, Log it with the duration
  pre-filled, feedback and back to Today; chat: a change card with a struck
  20 → 10 min diff, Undo, a workout added in a sentence, the health reply; Not
  today handing the session to chat; Ana's Today, Calendar, You, Settings and
  Demo controls; sign out.
- iOS Simulator (iPhone 17, iOS 27) in Expo Go SDK 57: Welcome, the wrong
  password state, Ana's Today with the floating tab bar and chat button, and
  chat opened full screen.
- Not run: an Android emulator or a physical device, the system file picker,
  the native calendar permission prompt, and the gym flow on native (the gym
  flow was exercised on web by its implementer).

## Local runtime and recovery

- Requirements: Node `^22.13` or `^24.3+`, npm, Watchman (recommended); Xcode
  for the iOS simulator, Android Studio for the emulator.
- Install once from the repository root: `npm ci`.
- Start: `npm start` (Expo dev server), then press `i`, `a` or `w`; or
  `npm run web` for the browser.
- Demo account: `ana@example.com` with any password of 8 or more characters.
  The password `wrong-password` shows the sign-in error. Continue with Google
  signs in a new account (Sam) that goes through onboarding; any other email
  creates a new account.
- Demo controls (You › Settings › Demo controls): latency, offline, fail the
  next plan build or chat change, a stale chat result, time travel, and Reset
  everything, which clears the mock data and signs out.
- Recovery: Reset everything, or clear the app's storage.

## Review and documentation

- [ ] Acceptance criteria verified and evidence attached to the PR.
- [ ] Required checks pass and one teammate approves.
- [ ] Affected product/development/runtime docs updated.
- [x] Secrets and personal data excluded from committed examples and logs.
- [x] Known limitations and follow-up work recorded: the Proposal fields in
      `src/api/types.ts`, no lock-screen gym timer, and the open items in
      `design/README.md` under "Not decided yet".
