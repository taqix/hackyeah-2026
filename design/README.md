# Design

Design reference for the MVP, exported from Claude Design. It is not app code:
port screens and components into `apps/mobile` (and `apps/web`) using these files
as the source of truth for look, copy, and tokens.

## Layout

- `system/` — design system: tokens (CSS custom properties), fonts, and
  `components.js` (reference React components). Rules for color, type, spacing,
  voice, and iconography are in [system/README.md](system/README.md).
- `prototype/screens.jsx` — sign in, activity and feedback screens as JSX,
  with the layout helpers and floating nav bar.
- `prototype/chat.jsx` — chat plan revision: screen 8 and states 8.1–8.16,
  with the change card, replies, message box and problem cards. See
  [Chat revision](#chat-revision).
- `prototype/onboarding.jsx` — questionnaire and preference screens 2–4, the
  option table and their choice pieces (segmented choice, check tile). See
  [Onboarding preferences](#onboarding-preferences).
- `prototype/home.jsx` — Home, the Today tab: screen 5 and states 5.1–5.15,
  with the week strip, hero cards, notes and session list. See [Home](#home).
- `prototype/workout.jsx` — in-workout tracking screens 6.1–6.9 and their
  pieces (number stepper, set list, sheet, metric tile, interval strip). See
  [In-workout tracking](#in-workout-tracking).
- `prototype/profile.jsx` — the You tab, screens 9–9.6: the assistant's summary
  with its sources, answers edited through the onboarding questions, feedback,
  and data and privacy. See [Profile](#profile).
- `index.html` — preview board showing every screen in light and dark.

## Preview

Browsers block JSX loaded from `file://`, so serve the folder:

```bash
python3 -m http.server 4800 --directory design
```

Open http://localhost:4800. The page live-reloads within a second of any saved
change under `design/`. In Claude Code, the `design` entry in
`.claude/launch.json` starts the same server. Navigate like Figma: two-finger scroll pans, pinch (or ⌘/Ctrl+scroll) zooms
at the cursor, Space+drag or dragging empty canvas pans. `Shift+1` fits,
`Shift+0` is 100%, `+`/`-` zoom. The view is kept across live reloads.
Query parameters:

- `?flow=onboarding|home|workout|chat|profile` — one flow only
- `?theme=light|dark` — one theme only

A frame with a dashed **Fold** line shows its whole scroll; the line marks the
bottom of the 844 pt screen.

## Screen map

| Flow | Screens (`SCREENS` id) | Product reference |
| --- | --- | --- |
| Onboarding | Sign in (`welcome`); preferences: Starting point (`starting`), Time (`time`), Activities (`activities`, `activities-none`), Places (`places`, `places-swim`), Good to know (`extras`); Review (`review`) | docs/product.md — Accounts; MVP journey steps 1–2. `docs/plan-creation/PREFERENCES.md` on `feat/llm-plan-creation` |
| Home | Today (`home`); the week: Friday selected (`home-friday`), Not today (`home-not-today`), Done for today (`home-done`), Plan updated (`home-updated`), Did it happen? (`home-check-in`), Week done (`home-week-done`); first plan: Building (`home-building`), Didn't build (`home-build-failed`), Day one (`home-day-one`); other weeks: Lighter (`home-lighter`), No set times (`home-no-times`), Quiet (`home-quiet`); Loading (`home-loading`), Can't load (`home-offline`), Guest demo (`home-guest`) | docs/product.md — steps 4–6, plan versions, guest demo. Plan contract and preferences draft on `feat/llm-plan-creation` |
| Workout | Activity; in-workout tracking: Run live (`run-live`), Run review (`run-review`), Log a set (`set-log`), Rest (`set-rest`), Timed hold (`timed`), Session plan (`session-plan`), End early (`end-early`), Strength summary (`strength-review`), Swim log (`swim-log`); Completion & feedback | docs/product.md — step 5; docs/grilling-summary.md — Feedback |
| Chat | Start (`chat`), From an activity (`chat-activity`); a change: Updating (`chat-updating`), Plan updated (`chat-updated`), Undone (`chat-undone`), Removed and added (`chat-removed`), New sport (`chat-sport`), Partly possible (`chat-partly`); no change: Nothing to change (`chat-nothing`), Needs a detail (`chat-detail`), Can't change that (`chat-cant`), Health and pain (`chat-health`); problems: Didn't work (`chat-failed`), Changed elsewhere (`chat-stale`), Offline (`chat-offline`); Guest demo (`chat-guest`), Demo limit (`chat-guest-limit`) | docs/product.md — step 6, plan generation and revisions, guest demo, deferred illness behaviour. Revision examples and `change_summary` in the plan contract on `feat/llm-plan-creation` |
| Profile | You (`profile`, `profile-first-week`); summary: How we see you (`profile-summary`), Why we think this (`profile-why`); Edit: time (`profile-edit-time`); Your feedback (`profile-feedback`); Data and privacy (`profile-privacy`) | `PREFERENCES.md` and `CONTRACT.md` on `feat/llm-plan-creation`; docs/product.md — Accounts |

## Onboarding preferences

Onboarding asks for the preference fields in `docs/plan-creation/PREFERENCES.md`
on `feat/llm-plan-creation`. Each question and option label is the doc's
wording; step headings (Start small, Good to know) and the one-line descriptions
under starting comfort are design copy. The app saves only option values.

| Step | Fields | Control |
| --- | --- | --- |
| 2 Starting point | `starting_comfort` | Radio cards |
| 3.1 Time | `sessions_per_week`, `session_minutes`, `preferred_times` (optional) | Segmented choice; check tiles showing each time range |
| 3.2 Activities | `activity_interests`, `discovery_preference` | Tags; radio cards |
| 3.3 Places | `available_locations`, `available_equipment`, `comfortable_swimming` (when asked) | Tags; inline yes/no |
| 3.4 Good to know | `avoidances`, `starting_obstacle` (both optional) | Tags; radio rows; **Skip** in the top bar |
| 4 Review | All of the above | One row per step, which opens it; **Build plan** starts generation |

Rules (the prototype applies them as you click):

- No activity picked: discovery is `explore` and the other two options are
  disabled (`activities-none`).
- At least one place; Continue is disabled without one.
- The swimming question shows only when Swim is picked, or a pool is picked
  and discovery isn't `selected_only` (`places-swim`). Unanswered stays `null`;
  only Yes (`true`) allows swimming.
- **No equipment** and **Nothing to avoid** save `[]` and clear the other chips.
  No preferred time saves `[]`; no obstacle saves `null`.
- Equipment is only what the user picks; a gym adds none.
- Not asked: `timezone` comes from the device (shown on the review), and
  `excluded_activity_types` starts as `[]`.

Sample answers are the doc's `examples/initial.input.json`, so the review shows
that fixture.

Not decided yet: the doc has no sport choice, so the old sport suggestions
screen became the review, but `docs/product.md` still has a choose-a-sport step
and lists football, which the contract doesn't include. Also, Bike without a
bicycle can never be planned: should Places warn, as it does for swimming, and
does a stationary bike count?

## Home

Home is the Today tab. It answers one question: what do I do today, and how is
my week going? Frame 5 is clickable: tap a day in the week strip to see it.

Top to bottom: greeting with the chat button, an optional note, the week strip,
the hero for the selected day, steps, the week's sessions, then **Need a
change?**. The floating tab bar stays on every state.

| Part | Shows | Data |
| --- | --- | --- |
| Week strip | Today filled. Done days tinted, with a check; planned days with a dot; a past session with no outcome in a dashed ring; another selected day in a ring | Day state, session outcome |
| Hero | A session to start (**Start**, **Not today**) or preview; a done day (how it felt, what's next); a rest day; or a plan or app state | Assignment, day `explanation` |
| Note | Accent: the plan changed (5.4). Warm: the first week (5.9). Info: a plan notice (5.10) or the guest demo (5.15) | `change_summary`, `notices` |
| Steps | Today's steps from the phone. Without access it asks, never shows a made-up zero | `useStepCounter()` on `codex/step-counter` |
| Sessions | Day, time and length, with Done, Today, Updated, Optional, Not logged or Skipped | Week `summary`, assignments |
| Need a change? | Chips that open chat with the request filled in | Chat (8) |

| Frame | When |
| --- | --- |
| 5, 5.1 | A normal morning; another day selected. Friday is outside Ana's preferred times and says so, as the contract requires |
| 5.2 | **Not today**: a simpler version, five minutes, move it, or skip with nothing to make up (preferences draft) |
| 5.3 | After completion and feedback (7) |
| 5.4 | The morning after a chat change: a note with the chat card's summary (8.3), and an Updated tag on the changed session |
| 5.5 | A past session has no outcome: **Log it** or **Skip it**, asked once |
| 5.6 | Sunday: the week is celebrated whatever was skipped; next week has one optional new activity |
| 5.7, 5.8 | The first plan is building; generation failed (no partial plan, answers kept) |
| 5.9 | First open after the plan is ready |
| 5.10–5.12 | Contract statuses `partial`, `unscheduled` (calendar unreadable: sessions without times, **Pick a day**) and `empty` |
| 5.13, 5.14 | Loading; the plan can't be fetched |
| 5.15 | Guest demo: seeded week and history, no name, a change limit |

Rules:

- One hero. Only a planned session uses the photo card (`SuggestionCard`);
  other days use a tinted card in the same slot: sage for rest, moss for done,
  peach for a finished week, sunken for plan and app states.
- No missed state. A past session without an outcome reads "Not logged" until
  the user answers; a skipped one looks like a rest day. Nothing creates
  catch-up sessions.
- Explanations come from the plan. They cite only what the user said, never
  claim automatic progress, and add "Outside your preferred times." when a
  slot is.
- Errors are announced (`role="alert"`), progress and notes are `status`.
  Skeleton and progress animations stop under reduced motion. Each strip day
  has a full label, for example "Wednesday 8, today, Walk-run intervals at 7:00".

Not decided yet: when next week's plan is generated (the frames assume week by
week, as in the contract's `next_week`); whether Calendar ships, since 5.10 and
5.11 only happen with it; whether Home is where steps belong; the guest change
limit (3 is a placeholder). The walk-run stays 24 min to match screens 6–7,
but the draft only offers 5, 10 or 20 minutes. Light-mode `--text-tertiary`
captions are 4.36:1 on the page and 4.03:1 on sunken surfaces, just under 4.5:1;
`--ink-500: #72685A` would pass (4.91:1 and 4.54:1).

## In-workout tracking

Each step of a session is tracked one of three ways. The plan step names the
way; the screen follows from it.

| Tracking | Used for | Planned as | Logged | Input |
| --- | --- | --- | --- | --- |
| `reps` | Strength exercises | `3 × 10 · 8 kg`, bodyweight `2 × 8`, `2 × 8 each side` | reps and weight (kg, optional) per set | Steppers pre-filled from the plan (6.3) |
| `time` | Holds, stretches, mobility, warm-up walks, football drills | `3 × 20 s`, `5 min` | seconds per round | Countdown; **Done** ends a round early and logs the real time (6.5) |
| `distance` | Walking, running, cycling, swimming | `24 min` with segments, `12 × 25 m` | time, distance, optional climb per session | Timer and GPS (6.1–6.2), or typed afterwards (6.9) |

How a session runs depends on its type:

- **Guided** (strength, mobility): one exercise per screen. A set done as
  planned is one tap; change a number only if you did something different.
  Rest starts by itself after a set (default 60 s) and can be skipped or
  extended. The session plan sheet (6.6) lets you do exercises in any order.
- **Continuous** (walking, running, cycling): one live screen for the whole
  session. Segments advance by time, with voice and vibration cues so the
  phone can stay in a pocket. Afterwards the user checks time, distance and
  climb (6.2).
- **Log afterwards** (swimming, or any session done without the phone): a
  short form (6.9). Swim distance is lengths × pool length. Watch data fills
  the fields only when the user taps **Use**.

Rules:

- Ending early saves what was done, and the session counts as done with its
  actual minutes (6.7). This matches the session feedback draft on
  `feat/llm-plan-creation` (`outcome: done`, `actual_minutes`).
- Summaries show what was done, never plan versus actual (6.8). An exercise
  not done reads "Not today". Logged numbers never change the plan by
  themselves.
- Effort uses the accent (run segments, the current set); rest and walking use
  `--recovery`. Every segment is also named in text.
- Steppers change by the exercise's step: reps and lengths 1, dumbbells 2 kg,
  machines 5 kg. Tapping the number opens the numeric keypad
  (`inputMode="numeric"`, or `"decimal"` for km). Buttons are 44 px or larger.
- In the app, keep the screen awake during guided sessions and show the
  current countdown on the lock screen (iOS Live Activity, Android ongoing
  notification).

Not decided yet: catalog steps need a tracking way and planned targets
(sets, reps, weight, seconds, rest, distance). Logs need per-set and per-round
entries, plus session time, distance and climb with their source (timer, GPS,
typed, watch). The plan contract currently stores only `actual_minutes`;
agree the shape in `packages/contracts` before building these screens.

## Chat revision

Chat answers one question: what should change in my plan? A valid change
becomes the active plan straight away (docs/product.md, step 6). There is no
confirm step, so every change shows exactly what moved and offers **Undo**.

Entry points: the Home header button and **Something else** open chat empty
(8); the other **Need a change?** chips open it with the request filled in;
**See the chat** on the Plan updated note (5.4) opens the thread; **Ask in chat**
on Not today (5.2) and **Adjust** on an activity (6) attach that session (8.1).

| Part | Shows |
| --- | --- |
| Change card | **Plan updated**, a one-line summary (the contract's `change_summary`), then one row per changed session: the day it is on now, its title, and each changed value as old (struck through) → new. **New** and **Removed** labels; a swapped session shows its old title struck through above the new one; a sport switch adds a Sport row. Rows for what couldn't change give the reason. A lock line names what stays, then **Undo** and **See week** |
| Reply | A coach message that changed nothing, always with "Plan unchanged" under it, and quick replies when a choice helps |
| Updating | Spinner, skeleton rows and "Your current plan stays as it is until the new one is ready." The message box is locked: one change at a time |
| Problem | Didn't work, or changed elsewhere. Both say the plan is as it was and offer **Try again** |
| Message box | "Changes apply straight away. You can undo.", the attached session, the guest counter or the offline note |

| Frame | When |
| --- | --- |
| 8 | First open: what you can ask. An example fills the box; nothing is sent until you send |
| 8.1 | Opened from a session, with quick replies |
| 8.2 | A change is running |
| 8.3 | Mornings and a shorter Friday, applied; Home 5.4 shows the result |
| 8.4 | Undone: the plan before the change is back |
| 8.5 | A session removed, then one added; the older card loses Undo |
| 8.6 | A sport switch swaps upcoming sessions only |
| 8.7 | Partly possible: moved to Saturday at 7:00, not 6:00, with the reason |
| 8.8 | Earlier changes folded by day; a request that changes nothing |
| 8.9 | A vague request: one question with quick answers |
| 8.10 | Done days and preview sports can't change |
| 8.11 | Pain or a health condition: no change, see a doctor, resting is fine |
| 8.12 | A timeout, a provider failure or a result that failed validation |
| 8.13 | The plan changed elsewhere while the request ran |
| 8.14 | Offline: the message waits, unsent |
| 8.15, 8.16 | Guest demo: a change counter; at the limit, sign up |

Rules:

- Apply, then show. A validated revision is the active plan before its card
  appears. Never ask "Apply these changes?"; Undo is the safety net.
- Every reply says whether the plan changed: a change card, or "Plan unchanged"
  under the message. Quick replies send at once; examples only fill the box.
- One row per session, in day order. Each changed value pairs the struck old
  value with the new one, so meaning never depends on colour. Screen readers
  hear "Time changed from 18:00 to 7:00".
- Done, skipped and started sessions never change and are never rows; the lock
  line names them ("Monday to Wednesday stay as you did them").
- Undo brings back the plan before this change as a new version and keeps
  everything logged since. Only the newest card has it; it goes once a newer
  change exists or a changed session has started. Undo doesn't use a guest change.
- One request at a time. The plan in use stays active until the new one passes
  validation. A result built on an older version is never applied (8.13); Try
  again rebuilds on the latest one.
- Nothing half-applies. Failure, offline and stale all keep the plan and the
  message: **Try again** resends it, **Edit message** puts it back in the box.
- Requests outside the plan's rules get a reason and a nearby option, never a
  silent workaround: done days, preview sports, the 7:00–21:00 window, one
  session a day, beginner scope. The valid part of a request still applies (8.7).
- Health: no condition-specific changes and no advice beyond seeing a doctor or
  physio (docs/product.md, deferred decisions).
- Errors are announced (`role="alert"`); updating is `role="status"`. Spinner,
  shimmer and caret stop under reduced motion. Captions on the page use
  `--text-secondary`, since `--text-tertiary` is under 4.5:1 there (see Home).

Not decided yet: Undo needs a backend call that restores a version; the docs
only say versions are kept. How long chat history is kept, and whether folded
cards reopen with their rows. The guest limit of 3 is a placeholder shared with
Home 5.15. Sport names follow docs/product.md (running, gym, fitness, football)
while onboarding uses the preference draft's six activity types; settle this
before building the sport switch (8.6).

## Profile

The You tab answers one question: what do I prefer, and how does the app see
me? It keeps three layers apart:

| Layer | What it holds | Changed by | Stored as |
| --- | --- | --- | --- |
| Answers | The onboarding preferences | The person only | `PREFERENCES.md` fields; `timezone` comes from the phone |
| Feedback | "Would you choose this again?" per session card, and whole activities switched off | The person only | `repeat_choice` per card; `excluded_activity_types` |
| Summary | Our assistant's description of the two layers above | Rebuilt by the app | Statements that each reference stored facts; never the record |

The screens show Ana on Wednesday 22 October, week 3, with the sessions from
`home.jsx`:

- **You (9, and 9.1 in week 1):** the summary card, then one row per onboarding
  step and **Your feedback**. In week 1 the summary says what it doesn't know yet.
- **Summary (9.2, 9.3):** each statement names its source. Tapping one opens the
  stored facts behind it, with a way to change them.
- **Edit (9.4):** each row opens its onboarding step with the same pieces and
  `PREF_OPTIONS`, a back arrow instead of steps, and **Save** instead of
  Continue. 9.4 shows Time; the other steps keep their onboarding rules.
- **Your feedback (9.5):** yes, maybe and no, per card. **Try again** sets one
  card back to no opinion. **Reset feedback** asks first, then clears every
  opinion but keeps history, answers and switched-off activities, which list
  here with **Switch on**.
- **Data and privacy (9.6):** connections, what our assistant sees, the account
  and the phone's time zone.

Summary rules:

- Every statement cites at least one stored fact: an answer, or a dated session
  and the answer given after it. Reuse the plan contract's evidence IDs
  (`continuity_facts`, `summary_evidence_ids`) and reject statements without one.
- Label it as written by our assistant and show when. Second person, no "I", no
  scores, streaks, percentages, personality labels or praise.
- It never changes anything. People correct it by changing the answer behind a
  statement, and the summary follows.
- With little data it says so (9.1). No answer is not a no, and a busy or
  skipped day never counts against an activity.
- Rebuild it when answers, feedback or switched-off activities change. Keep the
  old text, marked as updating, until the new one passes the checks. If
  generation fails, hide the card and show the answers; nothing waits for it.

Not decided yet: whether a saved answer changes the current week straight away
(designed: upcoming sessions change and done ones stay, as with chat revisions)
or only the next one. The summary is a new AI call that needs its own contract,
checks and fallback. Switching off a whole activity is placed in a session's
menu, which no screen shows yet. Also open: the calendar source (Google
Calendar, or the device calendar on `codex/device-calendar`), watch import
(`feat/wearable-data-extraction`, shown as Later), and account download and
deletion. Each "What our assistant sees" line is a promise; check it against
the backend before shipping.

## Porting notes

- Tokens are CSS variables; for Expo, translate `system/tokens/*.css` into a
  TypeScript theme (light + dark) rather than hard-coding values.
- Fonts: Bricolage Grotesque (display, numbers) and Hanken Grotesk (body), woff2
  in `system/fonts/`. Expo can load them via `expo-font` / `@expo-google-fonts`.
- Icons: Lucide (`lucide-react-native` on mobile, `lucide-react` on web).
- Styles are web-only in places (`color-mix`, `backdrop-filter`, CSS gradients);
  pick native equivalents when porting.
