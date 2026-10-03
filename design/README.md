# Design

Design reference for the MVP, exported from Claude Design. It is not app code:
port screens and components into `apps/mobile` (and `apps/web`) using these files
as the source of truth for look, copy, and tokens.

## Layout

- `system/` — design system: tokens (CSS custom properties), fonts, and
  `components.js` (reference React components). Rules for color, type, spacing,
  voice, and iconography are in [system/README.md](system/README.md).
- `prototype/screens.jsx` — welcome and sign in, activity and feedback screens
  as JSX, with the layout helpers and floating nav bar.
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
- `prototype/plan.jsx` — the Plan tab, screens 10–10.1: the week in full and the
  plan's versions. See [Plan](#plan).
- `prototype/log.jsx` — add a workout done outside the plan, screens 11–11B.6,
  in two variants to rate: a form (11A) and the chat (11B). See
  [Add a workout](#add-a-workout).
- `index.html` — preview board showing every screen in light and dark. It is the
  entry point for everything in `design/`: the nav links to the standalone pages
  below, and the **all** board shows each of them as a live preview after the
  phone screens. Add a new page to `PAGES` in `index.html`.
- `icons.html` — app icon concepts for Movo (the app's name), each in default,
  dark and tinted versions. No icon is chosen yet; nothing is exported to
  `apps/mobile`.
- Movo's product website now lives in [`apps/website`](../apps/website/README.md)
  as a React app. It started here as `website.html` and keeps a copy of
  `system/`; its phone mockups redraw Home 5, onboarding 2 and chat 8.3, so
  update them there when those screens or `system/` change.

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

- `?flow=onboarding|home|workout|chat|profile|plan|log` — one flow only
- `?theme=light|dark` — one theme only

A frame with a dashed **Fold** line shows its whole scroll; the line marks the
bottom of the 844 pt screen.

## Sources and what the docs cover

Docs win over this design. Where they disagree, the design follows them or the
gap is listed under **Not decided yet** in its flow.

| Doc | Where | Covers |
| --- | --- | --- |
| `docs/product.md`, `docs/grilling-summary.md` | `develop` | Journey, accounts and guest demo, plan versions, revisions, acceptance targets |
| `docs/plan-creation/` (`PREFERENCES.md`, `LLM_SCHEMA.md`, `SYSTEM_PROMPT.md`) | `feat/llm-plan-creation` | Preference fields and options; the plan generator's input (answers + free `available_slots`) and output (`events`: a start `time` and a `description`, or a gym `series`) |
| `docs/features/device-calendar.md`, `calendar-availability.md` | `develop`, `codex/calendar-availability` | Calendar access from an explicit tap; free slots; denial never reads as an empty calendar |
| `docs/features/system-step-counter.md` | `develop` | `useStepCounter()`: ready, permission-required, unavailable, error; never a made-up zero |
| `docs/features/activity-file-import.md`, `wearable-extraction.md` | `develop` | FIT/GPX import through the system file picker; server-side watch library (no UI yet) |

On 3 October `feat/llm-plan-creation` replaced its long plan contract
(`CONTRACT.md`) and preferences draft with the short contract above. These
design features relied on the removed docs and are now **proposals without a
doc**: the chat change card's summary and Undo (no revision input or version
restore in the contract), week summaries and notes (app copy), optional "new
activity" sessions, Not today's shortcuts, unscheduled weeks (5.11), per-session
"would you choose this again" feedback, the assistant summary (9–9.3), and
structured workout tracking (6.1–6.9). Each flow's **Not decided yet** names
what it needs.

## Demo persona

Every flow shows Ana in October 2026 (week 1 is Monday 5 to Sunday 11 October).
Her answers, shown on Review (4) and the You tab (9): starting from scratch;
3 days a week, 20 min, mornings; walk and run, occasionally something new;
outdoors and home, no equipment; avoid jumping; finding time is the hard part;
Europe/Warsaw.

| Day | Session | Week 1 as planned | After the chat change (Wed evening, 8.3) |
| --- | --- | --- | --- |
| Mon 5 | Brisk walk | 7:00 · 20 min, done (felt easy) | unchanged |
| Wed 7 | Walk-run intervals | 7:00 · 20 min, done (felt just right) | unchanged |
| Fri 9 | Walk-run intervals | 18:00 · 20 min (no free morning) | 7:00 · 10 min, then not logged and skipped |

Week 2 (12–18 Oct): walk-run Mon, optional gentle stretching Thu, easy walk
Sat. The You tab shows Wednesday 21 October, week 3. The strength (6.3–6.8) and
swim (6.9) frames show other sample plans. The doc fixture
`examples/initial.input.json` is a different person.

## Screen map

| Flow | Screens (`SCREENS` id) | Product reference |
| --- | --- | --- |
| Onboarding | Welcome (`welcome`), Sign in: no match (`sign-in-error`); preferences: Starting point (`starting`), Time (`time`), Activities (`activities`, `activities-none`), Places (`places`, `places-swim`, `places-bike`), Good to know (`extras`); Review (`review`), Review: calendar access off (`review-calendar-off`) | docs/product.md — Accounts and guest demo; MVP journey steps 1–2. `PREFERENCES.md`; `device-calendar.md` |
| Home | Today (`home`); the week: Friday selected (`home-friday`), Not today (`home-not-today`), Done for today (`home-done`), Plan updated (`home-updated`), Did it happen? (`home-check-in`), Week done (`home-week-done`); first plan: Building (`home-building`), Didn't build (`home-build-failed`), Day one (`home-day-one`); other weeks: Lighter (`home-lighter`), No set times (`home-no-times`), Quiet (`home-quiet`); Loading (`home-loading`), Can't load (`home-offline`), Guest demo (`home-guest`) | docs/product.md — steps 4–6, plan versions, guest demo. `LLM_SCHEMA.md` (events, partial and empty plans); `system-step-counter.md` |
| Workout | Activity; in-workout tracking: Run live (`run-live`), Run review (`run-review`), Log a set (`set-log`), Rest (`set-rest`), Timed hold (`timed`), Session plan (`session-plan`), End early (`end-early`), Strength summary (`strength-review`), Swim log (`swim-log`); Completion & feedback | docs/product.md — step 5; docs/grilling-summary.md — Feedback; `activity-file-import.md` |
| Chat | Start (`chat`), From an activity (`chat-activity`); a change: Updating (`chat-updating`), Plan updated (`chat-updated`), Undone (`chat-undone`), Removed and added (`chat-removed`), New sport (`chat-sport`), Partly possible (`chat-partly`); no change: Nothing to change (`chat-nothing`), Needs a detail (`chat-detail`), Can't change that (`chat-cant`), Health and pain (`chat-health`); problems: Didn't work (`chat-failed`), Changed elsewhere (`chat-stale`), Offline (`chat-offline`); Guest demo (`chat-guest`), Demo limit (`chat-guest-limit`) | docs/product.md — step 6, plan generation and revisions, guest demo, deferred illness behaviour. The change card and Undo have no contract yet |
| Profile | You (`profile`, `profile-first-week`); summary: How we see you (`profile-summary`), Why we think this (`profile-why`); Edit: time (`profile-edit-time`); Your feedback (`profile-feedback`); Data and privacy (`profile-privacy`) | `PREFERENCES.md`; docs/product.md — Accounts. Feedback and the summary have no doc yet |
| Plan | Plan (`plan`), Plan history (`plan-history`) | docs/product.md — plan generation and revisions (versions, kept history) |
| Add a workout | In your week (`log-week`); A · form: Try it (`log-form`), What did you do? (`log-pick`), Run (`log-run`), Swim (`log-swim`), Strength (`log-strength`), Add an exercise (`log-exercise`), Sets that differed (`log-sets`), Something else (`log-other`), Saved (`log-saved`); B · chat: Try it (`log-chat`), A run (`log-chat-run`), Needs a detail (`log-chat-detail`), A guess, then a fix (`log-chat-fix`), Strength (`log-chat-strength`), Speaking (`log-chat-voice`), Didn't work (`log-chat-failed`) | No doc yet. docs/product.md — step 5 (completion, how it felt); `PREFERENCES.md` activity types; `activity-file-import.md` |

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
| 4 Review | All of the above, plus calendar access | One row per step, which opens it; **Connect** asks for calendar access; **Build plan** starts generation |

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
- Bike picked without a bicycle or stationary bike: Places says biking will be
  left out, without blocking (`places-bike`). Cycling needs bicycle access.
- Calendar: the plan is built from free time (`available_slots`), and access
  must come from an explicit tap, so Review has a **Connect** row. Refused
  access shows **Settings** and never reads as an empty calendar (4.1).

Sample answers are Ana's (see [Demo persona](#demo-persona)).

Welcome (1): **Create account** and **Sign in** use email and password;
**Look around as a guest** creates a separate anonymous account with a seeded
week in one tap (docs/product.md). A wrong password says so in the field (1.1).

Not decided yet: the doc has no sport choice, so the old sport suggestions
screen became the review, but `docs/product.md` still has a choose-a-sport step
and lists gym, fitness, running and football, while the preferences have six
activity types. What the planner uses as free time when calendar access is
refused (the design assumes the preferred-time windows), and whether a
stationary bike counts as bicycle access (the design says yes). Google sign-in
was dropped: no doc includes it. Pending: the website already offers 1–7
sessions a week and 5–60 minutes in 5-minute steps, and PREFERENCES.md is due
to widen to match; until it does, onboarding (3.1), Edit time (9.4) and chat's
length snapping keep the contract's 1, 2, 3 and 5, 10, 20.

## Home

Home is the Today tab. It answers one question: what do I do today, and how is
my week going? Frame 5 is clickable: tap a day in the week strip to see it.

Top to bottom: greeting with the chat button, an optional note, the week strip,
the hero for the selected day, steps, the week's sessions, then **Need a
change?**. The floating tab bar stays on every state.

| Part | Shows | Data |
| --- | --- | --- |
| Week strip | Today filled. Done days tinted, with a check; planned days with a dot; a past session with no outcome in a dashed ring; another selected day in a ring | Day state, session outcome |
| Hero | A session to start (**Start**, **Not today**) or preview; a done day (how it felt, what's next); a rest day; or a plan or app state | Event `time` and `description`; length is `session_minutes` |
| Note | Accent: the plan changed (5.4). Warm: the first week (5.9). Info: a lighter week (5.10) or the guest demo (5.15) | The chat change's summary; app copy from the plan |
| Steps | Today's steps from the phone. Without access it asks, never shows a made-up zero | `useStepCounter()` (`system-step-counter.md`): ready shows the count; permission-required **Turn on**; denied **Open Settings**; unavailable and error say so, with **Try again** for errors |
| Sessions | Day, time and length, with Done, Today, Updated, Optional, Not logged or Skipped | The week's events and their outcomes |
| Need a change? | Chips that open chat with the request filled in | Chat (8) |

| Frame | When |
| --- | --- |
| 5, 5.1 | A normal morning; another day selected. Friday is outside Ana's preferred times and says so |
| 5.2 | **Not today**: a simpler version, five minutes, move it, or skip with nothing to make up (a proposal; see below) |
| 5.3 | After completion and feedback (7) |
| 5.4 | The morning after a chat change: a note with the chat card's summary (8.3), and an Updated tag on the changed session |
| 5.5 | A past session has no outcome: **Log it** or **Skip it**, asked once |
| 5.6 | Sunday: the week is celebrated whatever was skipped; next week has one optional new activity |
| 5.7, 5.8 | The first plan is building; generation failed (no partial plan, answers kept) |
| 5.9 | First open after the plan is ready |
| 5.10–5.12 | Other weeks, not Ana's story: a partial plan (fewer events than asked), an unscheduled week (calendar unreadable: sessions without times, **Pick a day**) and an empty plan (`{"events": []}`) |
| 5.13, 5.14 | Loading; the plan can't be fetched |
| 5.15 | Guest demo: seeded week and history, no name, a change limit |

Rules:

- One hero. Only a planned session uses the photo card (`SuggestionCard`);
  other days use a tinted card in the same slot: sage for rest, moss for done,
  peach for a finished week, sunken for plan and app states.
- No missed state. A past session without an outcome reads "Not logged" until
  the user answers; a skipped one looks like a rest day. Nothing creates
  catch-up sessions.
- The hero body is the event's `description` from the plan. It never claims
  automatic progress or feedback the planner didn't get, and the app adds
  "Outside your preferred times." when the start falls outside them.
- Errors are announced (`role="alert"`), progress and notes are `status`.
  Skeleton and progress animations stop under reduced motion. Each strip day
  has a full label, for example "Wednesday 7, today, Walk-run intervals at 7:00".
- The guest demo note links to **Make a plan of your own** (a new account; no
  guest conversion in the MVP).

Not decided yet: when next week's plan is generated (the frames assume week by
week, made on Sunday); whether Home is where steps belong; the guest change
limit (3 is a placeholder). Beyond the current contract: unscheduled weeks
(5.11; every event has a time and no free slots means no events), an optional
flag for a new activity, and Not today's shortcuts (each would be a plan
change like a chat request).

## In-workout tracking

Each step of a session is tracked one of three ways. The plan step names the
way; the screen follows from it.

| Tracking | Used for | Planned as | Logged | Input |
| --- | --- | --- | --- | --- |
| `reps` | Strength exercises | `3 × 10 · 8 kg`, bodyweight `2 × 8`, `2 × 8 each side` | reps and weight (kg, optional) per set | Steppers pre-filled from the plan (6.3) |
| `time` | Holds, stretches, mobility, warm-up walks, football drills | `3 × 20 s`, `5 min` | seconds per round | Countdown; **Done** ends a round early and logs the real time (6.5) |
| `distance` | Walking, running, cycling, swimming | `20 min` with segments, `12 × 25 m` | time, distance, optional climb per session | Timer and GPS (6.1–6.2), or typed afterwards (6.9) |

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
  short form (6.9). Swim distance is lengths × pool length. **Choose file**
  imports a FIT or GPX file from a watch app instead (activity-file-import:
  the system picker, parsed on the phone).

Ana's walk-run (6, 6.1–6.2) is 20 min: 4 min walk, 6 × (1 min run + 1 min
walk), 4 min walk. The strength frames (6.3–6.8) show another sample plan: a
20-minute gym session with dumbbells and bodyweight only, since the equipment
list has no machines.

Rules:

- Ending early saves what was done, and the session counts as done with its
  actual minutes (6.7). No current doc defines session outcomes; the removed
  feedback draft used `outcome: done` with `actual_minutes`.
- Summaries show what was done, never plan versus actual (6.8). An exercise
  not done reads "Not today". Logged numbers never change the plan by
  themselves.
- Effort uses the accent (run segments, the current set); rest and walking use
  `--recovery`. Every segment is also named in text.
- Steppers change by the exercise's step: reps and lengths 1, dumbbells 2 kg.
  Tapping the number opens the numeric keypad
  (`inputMode="numeric"`, or `"decimal"` for km). Buttons are 44 px or larger.
- In the app, keep the screen awake during guided sessions and show the
  current countdown on the lock screen (iOS Live Activity, Android ongoing
  notification).

Not decided yet: the plan contract gives each session only a free-text
`description` (or a gym `series` of descriptions), so the tracking way and
planned targets (sets, reps, weight, seconds, rest, distance) have no source.
Logs need per-set and per-round entries, plus session time, distance and climb
with their source (timer, GPS, typed, file). Nothing stores completion yet;
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
| Change card | **Plan updated**, a one-line summary (no contract field yet; the backend writes it from the two versions), then one row per changed session: the day it is on now, its title, and each changed value as old (struck through) → new. **New** and **Removed** labels; a swapped session shows its old title struck through above the new one; a sport switch adds a Sport row. Rows for what couldn't change give the reason. A lock line names what stays, then **Undo** and **See week** |
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
| 8.10 | Done days and sports we don't plan can't change |
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
  silent workaround: done days, sports we don't plan, the 7:00–21:00 window, one
  session a day, 5, 10 or 20 minutes, beginner scope. The valid part of a request
  still applies (8.7); an asked-for length snaps to the nearest allowed one below.
- Health: no condition-specific changes and no advice beyond seeing a doctor or
  physio (docs/product.md, deferred decisions).
- Errors are announced (`role="alert"`); updating is `role="status"`. Spinner,
  shimmer and caret stop under reduced motion. Each message tells screen readers
  who said it ("You:" or "Coach:").

Not decided yet: the plan generator's input has no request text, base plan or
operation, so how a chat message becomes a new version is undefined; the
current contract can't shorten one session either (every event lasts
`session_minutes`). Undo needs a backend call that restores a version; the docs
only say versions are kept. The 7:00–21:00 window is a proposed rule; the docs
only prefer the morning, lunch and evening ranges. How long chat history is
kept, and whether folded cards reopen with their rows. The guest limit of 3 is a placeholder shared with
Home 5.15. Sport names follow docs/product.md (running, gym, fitness, football)
while onboarding uses the preference draft's six activity types; settle this
before building the sport switch (8.6).

## Profile

The You tab answers one question: what do I prefer, and how does the app see
me? It keeps three layers apart:

| Layer | What it holds | Changed by | Stored as |
| --- | --- | --- | --- |
| Answers | The onboarding preferences | The person only | `PREFERENCES.md` fields; `timezone` comes from the phone |
| Feedback | "Would you choose this again?" per session, and whole activities switched off | The person only | A yes, maybe or no per session (no doc yet); `excluded_activity_types` |
| Summary | Our assistant's description of the two layers above | Rebuilt by the app | Statements that each reference stored facts; never the record |

The screens show Ana on Wednesday 21 October, week 3, with the sessions from
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
- **Data and privacy (9.6):** connections, what our assistant sees (the plan
  generator gets her answers and free times; the summary also reads her
  feedback), the account and the phone's time zone.

Summary rules:

- Every statement cites at least one stored fact: an answer, or a dated session
  and the answer given after it. Reject statements without one. (The removed
  plan contract had evidence IDs for this; the summary needs its own.)
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
or only the next one. The summary and the per-session feedback have no doc:
the summary is a new AI call that needs its own contract, checks and fallback,
and the plan generator doesn't read feedback at all. Switching off a whole
activity is placed in a session's menu, which no screen shows yet. Also open:
Google Calendar as a second calendar source (the device calendar is on
`develop`), watch connections (the wearable library on `develop` is
server-side; shown as Later; FIT/GPX import is used in 6.9), a guest version of
this tab, and account download and deletion. Each "What our assistant sees" line is a promise; check it against
the backend before shipping.

## Add a workout

Add a workout answers one question: how do I record something I did that wasn't
in my plan? An extra swim, a run with a friend, a strength session at home. It
comes in two variants, to rate side by side and keep one. The frames show Ana on
Thursday 8 October, a rest day (Home 5.4).

| | A · Form (11A) | B · Chat (11B) |
| --- | --- | --- |
| Way in | **Add a workout**, the last row of Home's week list (11), opens the picker | The same row opens the chat with the logging prompt |
| How | Pick the activity, fill its few fields, Save | Say it in a sentence, typed or spoken; a card shows what was saved |
| A 30-minute run, 3.1 km | 5 taps and typing "3.1" (4 taps without distance) | One sentence and Send |
| Four strength exercises | About 5 taps and two numbers per exercise | One message |
| Mistakes | Every field is visible before saving | Saved, then shown field by field; fix in words, or Edit opens the form |
| Needs | No AI call; works offline | An AI call per message: wait time, cost, a guest limit, nothing offline |

Rules for both:

- One required answer: how long. Strength takes an exercise instead; Something
  else also needs a name. Everything else is optional and starts empty: no
  made-up distance, weight or reps.
- Saved straight away, with Undo: a toast in A, the card in B. No confirm step,
  as with chat revisions.
- An added workout is history, not a plan session. It never changes the plan by
  itself and isn't counted in "2 of 3 done". Home's week list shows it on its
  day with an **Extra** tag (11).
- When: today by default, yesterday, or one of the five days before. No future
  dates.
- Strength exercises are named by the person and counted one of the three
  tracking ways of 6.x: reps (weight optional), time or distance. Sets that were
  all the same take one line; **Sets weren't the same?** opens one row per set,
  and **Add a set** copies the last one. Suggestions fill the name and how it's
  counted, never the numbers.
- Walk, run, bike and swim offer the FIT/GPX import (`FileImport`, as on 6.9).
  The file fills the fields; the person still saves.

| Activity | Asks | Required |
| --- | --- | --- |
| Walk, Run, Bike | When, how long, distance (km) | How long |
| Swim | When, how long, lengths × pool length (25, 33 or 50 m) | How long |
| Strength | When, exercises (name, how it's counted, sets), how long | How long or one exercise |
| Stretch | When, how long | How long |
| Something else | Name, when, how long | Name and how long |

Every activity also asks **How did it feel?** (optional) with the four answers
of screen 7. How long is one tap for 15, 30, 45 or 60 minutes; **Other** opens
the keypad.

Chat rules (B):

- Every reply says whether anything was saved: a **Workout added** card, or
  "Nothing saved yet" under a question.
- Only how long is ever asked for, as one question with quick answers (11B.2).
  How it felt is answered in the card, never asked as a question.
- A missing detail that changes a number, like the pool length, is guessed and
  labelled as a guess (11B.3). A fix in words strikes through the old values.
- The card shows every field as saved. **Edit** opens A's form, filled in;
  **Undo** removes the workout. Only the newest card keeps them; older workouts
  are edited from the week list.
- Speaking: the microphone sits in the empty message box. Words show as they're
  heard, and **Stop** puts them in the box to check before sending (11B.5).
- Nothing half-saves. A failure says so, with **Try again** and **Use the form**
  (11B.6).
- Logging shares the plan chat (8), so its header says **Coach** instead of
  "Change your plan". Pain words get 8.11's reply; the workout is still saved.

How to rate: in 11A and 11B (both clickable), log the same three workouts: a
30-minute run with its distance, a swim with lengths, and the four-exercise
strength session. Compare the taps and typing, how sure you are of what was
saved, and how a mistake gets fixed. Keeping both is possible: the form as the
way in, and chat as a shortcut that fills the same fields.

Not decided yet: no doc covers added workouts. They need a log shape in
`packages/contracts` (activity type, date, minutes, optional distance, lengths
and pool length, how it felt, and for strength a list of exercises with a
tracking way and sets); the plan's gym `series` is free text, so it can't be
reused. Also open: whether the plan generator reads added workouts (its input is
preferences and free slots only), whether Home's week strip marks a day that
only has an extra, and where older added workouts are edited (the week list row
is assumed). The chat variant needs its own AI call with validation and a guest
limit; voice needs the phone's speech recognition and microphone permission.
Activities follow onboarding's six types; football (docs/product.md) is logged
as Something else.

## Porting notes

- Tokens are CSS variables; for Expo, translate `system/tokens/*.css` into a
  TypeScript theme (light + dark) rather than hard-coding values.
- Fonts: Bricolage Grotesque (display, numbers) and Hanken Grotesk (body), woff2
  in `system/fonts/`. Expo can load them via `expo-font` / `@expo-google-fonts`.
- Icons: Lucide (`lucide-react-native` on mobile, `lucide-react` on web).
- Styles are web-only in places (`color-mix`, `backdrop-filter`, CSS gradients);
  pick native equivalents when porting.
- Small controls (36 px buttons, 40 px tags, 24 px chip close) keep their look;
  give them `hitSlop` so every target reaches 44 pt.
- Status colours as text use `--success-text`, `--danger-text` and `--info-text`
  (4.5:1 or more on every surface); `--success`, `--danger` and `--info` are for
  icons, dots and borders.

## Plan

The Plan tab answers one question: what is my plan, and how did it get here?
Home shows today; Plan shows the whole week with each upcoming session's own
`description` from the plan (for gym, its `series`), and the versions behind it.

- **Plan (10):** Thursday 8 October, after the chat change. Done sessions
  collapse to their length and how they felt; upcoming ones show what to do.
  Next week waits for Sunday. A lock line says done sessions stay as they were
  and changes go through chat.
- **Plan history (10.1):** one entry per version, newest first: where it came
  from (first plan, chat, undo), when, and its summary. Done sessions keep the
  version they were done in (docs/product.md).

Not decided yet: the plan horizon (the frames assume one week at a time), and
whether older versions can be opened in full.
