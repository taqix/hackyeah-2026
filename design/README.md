# Design

Design reference for the MVP, exported from Claude Design. It is not app code:
port screens and components into `apps/mobile` (and `apps/web`) using these files
as the source of truth for look, copy, and tokens.

The 3 October review ([docs/mobile-review-2026-10-03.md](../docs/mobile-review-2026-10-03.md))
narrowed the MVP to a plan fitted to the calendar, the chat, and simple logging.
The screens below apply it; each flow says what changed.

## Layout

- `system/` — design system: tokens (CSS custom properties), fonts, and
  `components.js` (reference React components). Rules for color, type, spacing,
  voice, and iconography are in [system/README.md](system/README.md).
- `prototype/screens.jsx` — welcome and sign in, activity and feedback screens
  as JSX, with the layout helpers and the floating tab bar with its chat
  button. See [Chat placement](#chat-placement).
- `prototype/onboarding.jsx` — questionnaire and preference screens 2–4, the
  option table and their choice pieces (segmented choice, slider, two-handle
  range slider, checkbox rows, sport search). See
  [Onboarding preferences](#onboarding-preferences).
- `prototype/home.jsx` — Home, the Today tab: screen 5 and states 5.1–5.13,
  with the week strip and its arrows, hero cards and session list. See [Home](#home).
- `prototype/workout.jsx` — workouts 6.1–6.10: the log-it form built from a
  sport's catalog metrics, with `.fit`/`.gpx` import, and the guided gym screens
  (number stepper, set list, sheet). See [Workouts and logging](#workouts-and-logging).
- `prototype/chat.jsx` — chat: screen 8 and states 8.1–8.16, with the change
  card, replies, message box and problem cards, moving a missed session and adding
  a workout done outside the plan. See [Chat](#chat).
- `prototype/profile.jsx` — the You tab, screens 9–9.7: the assistant's summary
  with its sources, answers edited through the onboarding questions, feedback,
  settings, and data and privacy. See [Profile](#profile).
- `prototype/calendar.jsx` — the Calendar tab, screens 10–10.1: a month of
  sessions and the plan's versions. See [Calendar](#calendar).
- `index.html` — preview board showing every screen in light and dark. It is the
  entry point for everything in `design/`: the nav links to the standalone pages
  below, and the **all** board shows each of them as a live preview after the
  phone screens. Add a new page to `PAGES` in `index.html`.
- `icons.html` — app icon concepts for Movo (the app's name), each in default,
  dark and tinted versions. No icon is chosen yet; nothing is exported to
  `apps/mobile`.
- `website.html` — Movo's product website: a landing page that presents the app
  as shipped, and a clickable demo (questions, sport choice, plan creation,
  marking a session done, a chat change with Undo). It reuses `system/` only,
  not `prototype/`; its phone mockups redraw Home 5, onboarding 2 and chat 8.3,
  so update them when those screens change, then run `scripts/sync-website.sh`.
  Plan and chat logic are fixed front-end rules standing in for the API and AI
  step. The page never mentions plan versions or what the demo leaves out. The
  website keeps its guest demo; the mobile app has none. Open
  http://localhost:4800/website.html (`#/try/sample` jumps straight to a seeded
  guest plan).

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

- `?flow=onboarding|home|workout|chat|profile|calendar` — one flow only
- `?theme=light|dark` — one theme only

A frame with a dashed **Fold** line shows its whole scroll; the line marks the
bottom of the 844 pt screen.

## Sources and what the docs cover

Docs win over this design. Where they disagree, the design follows them or the
gap is listed under **Not decided yet** in its flow.

| Doc | Where | Covers |
| --- | --- | --- |
| `docs/product.md`, `docs/grilling-summary.md` | `develop` | Journey, accounts and guest demo, plan versions, revisions, acceptance targets |
| `docs/mobile-review-2026-10-03.md` | this branch | The 3 October review: scope cuts, Google and email sign-in, no mobile guest, one-week plans, the sport catalog and one logging form, the chat button |
| `docs/plan-creation/` (`PREFERENCES.md`, `LLM_SCHEMA.md`, `SYSTEM_PROMPT.md`) | `feat/llm-plan-creation` | Preference fields and options; the plan generator's input (answers + free `available_slots`) and output (`events`: a start `time` and a `description`, or a gym `series`) |
| `docs/features/gemini-plan-exchange.md`, `packages/contracts/src/plan-types.ts` | `codex/gemini-plan-contract` | The sport catalog (sports with IDs; non-gym sports list metrics with a key, description, required, value schema and unit; gym exercises have sets and repetitions); create and modify modes, where chat sends the conversation and gets add/delete operations and a message back |
| `docs/features/device-calendar.md`, `calendar-availability.md` | `develop`, `codex/calendar-availability` | Calendar access from an explicit tap; free slots; denial never reads as an empty calendar |
| `docs/features/system-step-counter.md` | `develop` | `useStepCounter()`: ready, permission-required, unavailable, error; never a made-up zero |
| `docs/features/activity-file-import.md`, `wearable-extraction.md` | `develop` | `.fit`/`.gpx` import through the system file picker; server-side watch library (no UI yet) |

On 3 October `feat/llm-plan-creation` replaced its long plan contract
(`CONTRACT.md`) and preferences draft with the short contract above. These
design features relied on the removed docs and are now **proposals without a
doc**: the chat change card's summary and Undo (the Gemini modify mode returns
a message and operations, but no version restore), week summaries (app copy),
optional "new activity" sessions, Not today's shortcuts, per-session "would you
choose this again" feedback, the assistant summary (9–9.3), and the shape of
logged sessions and gym sets (6.1–6.10). Each flow's **Not decided yet** names
what it needs.

## Demo persona

Every flow shows Ana in October 2026 (week 1 is Monday 5 to Sunday 11 October).
Her answers, shown on Review (4) and the You tab (9): starting from scratch;
3 days a week, 20 min, between 7:00 and 11:00; walk and run, occasionally
something new; outdoors and home, no equipment; avoid jumping; finding time is
the hardest part; Europe/Warsaw.

| Day | Session | Week 1 as planned | After the chat change (Wed evening, 8.3) |
| --- | --- | --- | --- |
| Mon 5 | Brisk walk | 7:00 · 20 min, done (felt easy) | unchanged |
| Wed 7 | Walk-run intervals | 7:00 · 20 min, done (felt just right) | unchanged |
| Thu 8 | Football with friends | not in the plan | added in chat, 1 h (8.16): an extra |
| Fri 9 | Walk-run intervals | 18:00 · 20 min (no free morning) | 7:00 · 10 min; not logged, so Saturday asks (5.5); Move it led to chat, where Ana skipped it (8.15) |

Week 2 (12–18 Oct): walk-run Mon, optional gentle stretching Thu, easy walk
Sat, all done. Week 3 (19–25 Oct): walk-run Mon, a hill walk Tue (felt hard),
walk-run Fri. Home 5.10 shows Wednesday 14 October; the Calendar (10) and You
(9) tabs show Wednesday 21 October, week 3. The gym (6.3–6.8), swim (6.9) and
football (6.10) frames show other sample plans. The doc fixture
`examples/initial.input.json` is a different person.

## Screen map

| Flow | Screens (`SCREENS` id) | Product reference |
| --- | --- | --- |
| Onboarding | Welcome (`welcome`), Email: account found (`sign-in`), Email: new account (`sign-up`), Sign in: wrong password (`sign-in-error`); preferences: Starting point (`starting`), Time (`time`), Activities (`activities`, `activities-search`, `activities-none`), Places (`places`), Good to know (`extras`); Review (`review`), Review: calendar access off (`review-calendar-off`) | docs/product.md — Accounts and guest demo; MVP journey steps 1–2. `PREFERENCES.md`; `device-calendar.md`; the review |
| Home | Today (`home`); the week: Friday selected (`home-friday`), Not today (`home-not-today`), Done for today (`home-done`), Plan updated (`home-updated`), Did it happen? (`home-check-in`), Week done (`home-week-done`); first plan: Building (`home-building`), Didn't build (`home-build-failed`), Day one (`home-day-one`); other weeks: An earlier week (`home-earlier-week`), Quiet (`home-quiet`); Loading (`home-loading`), Can't load (`home-offline`) | docs/product.md — steps 4–6, plan versions, one week ahead. `LLM_SCHEMA.md` (events, partial and empty plans); `system-step-counter.md` |
| Workouts | Activity (`activity`); log it: Walk-run (`log-it`), From a .fit file (`log-it-file`), Swim (`swim-log`), Football (`log-it-football`); gym: Log a set (`set-log`), Rest (`set-rest`), Timed hold (`timed`), Session plan (`session-plan`), End early (`end-early`), What you did (`strength-review`); Completion & feedback (`feedback`) | docs/product.md — step 5; docs/grilling-summary.md — Feedback; `activity-file-import.md`; the sport catalog |
| Chat | Start (`chat`), From an activity (`chat-activity`); a change: Updating (`chat-updating`), Plan updated (`chat-updated`), Undone (`chat-undone`), Removed and added (`chat-removed`), New sport (`chat-sport`), Partly possible (`chat-partly`); no change: Nothing to change (`chat-nothing`), Needs a detail (`chat-detail`), Can't change that (`chat-cant`), Health and pain (`chat-health`); problems: Didn't work (`chat-failed`), Changed elsewhere (`chat-stale`), Offline (`chat-offline`); Move a missed session (`chat-move`), A workout you did (`chat-workout`) | docs/product.md — step 6, plan generation and revisions, deferred illness behaviour. The Gemini modify mode; the change card and Undo have no contract yet |
| Profile | You (`profile`, `profile-first-week`); summary: How we see you (`profile-summary`), Why we think this (`profile-why`); Edit: time (`profile-edit-time`); Your feedback (`profile-feedback`); Settings (`profile-settings`); Data and privacy (`profile-privacy`) | `PREFERENCES.md`; docs/product.md — Accounts. Feedback and the summary have no doc yet |
| Calendar | Calendar (`calendar`), Plan history (`plan-history`) | docs/product.md — plan generation and revisions (one week ahead, versions, kept history) |

## Onboarding preferences

Onboarding asks for the preference fields in `docs/plan-creation/PREFERENCES.md`
on `feat/llm-plan-creation`, changed as the review agreed. Each question and
option label is the doc's wording; step headings (Start small, Good to know) and
the one-line descriptions under starting comfort are design copy. The app saves
only option values.

| Step | Fields | Control |
| --- | --- | --- |
| 2 Starting point | `starting_comfort` | Radio cards |
| 3.1 Time | `sessions_per_week` (1–7), `session_minutes` (5–60 in 5s), `preferred_window` (optional) | Sliders: the value spelled out, a tick per step and numbers under the track. The window is one two-handle slider over whole hours |
| 3.2 Activities | `activity_interests` (catalog sport IDs), `discovery_preference` | Suggested sports as tags, every other sport through search; radio cards |
| 3.3 Places | `available_locations`, `available_equipment` | Tags |
| 3.4 Good to know | `avoidances`, `starting_obstacles` (both optional) | Checkbox lists; **Skip** in the top bar |
| 4 Review | All of the above, plus calendar access | One row per step, which opens it; **Connect** asks for calendar access; **Build plan** starts generation |

Rules (the prototype applies them as you click):

- No sport picked: discovery is `explore` and the other two options are
  disabled (`activities-none`).
- At least one place; Continue is disabled without one.
- Sports come from the database catalog. Six are suggested as tags. Search
  matches anywhere in a name (`activities-search`); a pick joins the tags,
  selected, so it can be undone there, and Enter picks the first match. A name
  with no match says so and changes nothing.
- The time window is whole hours inside 7:00–21:00, the window chat already
  plans in, and at least an hour wide. The whole bar reads "Any time" and saves
  `null`. Ana's 7:00–11:00 is the old "Morning".
- **No equipment** saves `[]` and clears the other chips. Nothing ticked in Good
  to know saves `[]`, so there is no "Nothing to avoid" option to keep in sync.
- Equipment is only what the user picks; a gym adds none.
- Not asked: `timezone` comes from the device (shown on the review), and
  `excluded_activity_types` starts as `[]`.
- Removed in the review: the swimming comfort question (picking Swim is
  enough) and the note that biking needs a bicycle (the planner still checks it).
- Calendar: the plan is built from free time (`available_slots`), and access
  must come from an explicit tap, so Review has a **Connect** row. Refused
  access shows **Settings** and never reads as an empty calendar (4.1).

Sample answers are Ana's (see [Demo persona](#demo-persona)).

Welcome (1): **Continue with Google**, or an email address and **Continue with
email**. One field for everyone: if an account uses the email, 1.1 asks for its
password, with **Forgot password?**; if not, 1.2 asks for a new one and creates
the account. A wrong password says so in the field (1.3). **Change** goes back
to the email. Supabase Auth covers both ways. There is no guest entry on mobile;
the website demo keeps one.

The app also asks a new email account for **Your name** above the new password
on 1.2 (required, up to 50 characters), and Today and the You tab greet by it.
Settings (9.6) has a **Name** row that changes it in a sheet. Not designed yet:
neither has a prototype screen; the app builds both from the kit's Input,
ListRow and Sheet.

Not decided yet: the new field shapes (`preferred_window`, `starting_obstacles`
as an array, `activity_interests` as catalog IDs) need `PREFERENCES.md` and the
plan contract updated; `codex/gemini-plan-contract` already takes catalog IDs.
The doc has no sport choice, so the old sport suggestions screen became the
review, while `docs/product.md` keeps a choose-a-sport step. What the planner
uses as free time when calendar access is refused (the design assumes the
preferred window), and whether a stationary bike counts as bicycle access (the
design says yes). Pending: PREFERENCES.md is due to widen to 1–7 sessions and
5–60 minutes in 5-minute steps, which the sliders already use; chat's length
snapping still keeps the contract's 5, 10, 20.

## Home

Home is the Today tab. It answers one question: what do I do today, and how is
my week going? Frame 5 is clickable: tap a day in the week strip to see it.
Frames 5.6 and 5.10 also page between weeks.

Top to bottom: greeting, an optional note, the week (its dates, arrows and
strip), the hero for the selected day, steps, the week's sessions, then **Need a
change?**. The floating tab bar stays on every state. The chat button sits
beside it (see [Chat placement](#chat-placement)), so the header has none.

| Part | Shows | Data |
| --- | --- | --- |
| Week | The dates with "this week", "last week" or "next week", **‹** and **›**, and the strip: today filled, done days tinted with a check, planned days with a dot, a past session with no outcome in a dashed ring, another selected day in a ring | Plans go one week ahead; history in full |
| Hero | A session to start (**Start**, **Not today**) or preview; a done day (how it felt, what's next); a rest day; a missed session (**Log it**, **Move it**); or a plan or app state | Event `time` and `description`; length is `session_minutes` |
| Note | Only one: the plan changed (5.4), with the chat card's summary. The first-week and lighter-week notes were dropped as clutter | The chat change's summary |
| Steps | Today's steps from the phone. Without access it asks, never shows a made-up zero | `useStepCounter()` (`system-step-counter.md`): ready shows the count; permission-required **Turn on**; denied **Open Settings**; unavailable and error say so, with **Try again** for errors |
| Sessions | Day, time and length, with Done, Today, Updated, Optional, Not logged or Skipped | The week's events and their outcomes |
| Need a change? | Two chips that open chat with the request filled in | Chat (8) |

| Frame | When |
| --- | --- |
| 5, 5.1 | A normal morning; another day selected. Friday is outside Ana's preferred window and says so. Both arrows are off: there are no earlier weeks, and next week is planned on Sunday |
| 5.2 | **Not today**: a simpler version, five minutes, move it, or skip with nothing to make up. Each opens chat with the request filled in (a proposal; see below) |
| 5.3 | After completion and feedback (7) |
| 5.4 | The morning after a chat change: the note with the chat card's summary (8.3), and an Updated tag on the changed session |
| 5.5 | A past session has no outcome: **Log it** or **Move it**, asked once. Move it opens chat with the session attached (8.15) |
| 5.6 | Sunday: the week is celebrated whatever was skipped, with one plain line on why it matters. Next week is planned now, so **›** opens it and the list previews it |
| 5.7, 5.8 | The first plan is building; generation failed (no partial plan, answers kept) |
| 5.9 | First open after the plan is ready |
| 5.10 | Wednesday of week 2, paged back to week 1: history is read-only, and **This week** jumps back |
| 5.11 | An empty plan (`{"events": []}`), not Ana's story |
| 5.12, 5.13 | Loading; the plan can't be fetched |

Rules:

- One hero. Only a planned session uses the photo card (`SuggestionCard`);
  other days use a tinted card in the same slot: sage for rest, moss for done,
  peach for a finished week, sunken for plan and app states.
- No missed state. A past session without an outcome reads "Not logged" until
  the user answers **Log it** or **Move it**. Skipping is offered in chat, last
  and quietly, so moving reads as the normal choice; a skipped session looks
  like a rest day. Nothing creates catch-up sessions.
- Plans go one week ahead. **‹** pages through every past week back to the
  first; **›** opens a week only once it's planned (on Sunday), so at most one
  week ahead. Past weeks are read-only and show no week summary.
- The greeting follows the time of day: "Good morning" until noon, "Good
  afternoon" until 18:00, then "Good evening".
- A finished week is celebrated without hype: encouragement and one plain
  reason it matters, never streaks or scores.
- The hero body is the event's `description` from the plan. It never claims
  automatic progress or feedback the planner didn't get, and the app adds
  "Outside your preferred times." when the start falls outside them.
- Errors are announced (`role="alert"`), progress and notes are `status`.
  Skeleton and progress animations stop under reduced motion. Each strip day
  has a full label, for example "Wednesday 7, today, Walk-run intervals at 7:00".

Not decided yet: whether Home is where steps belong; an optional flag for a new
activity, and Not today's shortcuts (each would be a plan change like a chat
request). Unscheduled weeks were dropped in the review: no free slots means no
events (5.11).

## Workouts and logging

Only gym sessions are tracked live. Every other sport is done the person's own
way, with a watch or without, and logged afterwards on one form. There are no
GPS, maps, calories or exercise videos (review, 3 October).

| Sport | During | Afterwards | Screens |
| --- | --- | --- | --- |
| Gym (`is_gym: 1` in the catalog) | Guided: one exercise per screen, a set per tap, a rest timer | What you did (6.8), then feedback (7) | 6.3–6.8 |
| Any other sport | Nothing runs: the activity (6) shows the plan's parts, with **Log it** | The log-it form, typed or from a file, then feedback (7) | 6.1, 6.2, 6.9, 6.10 |

The log-it form:

- Its fields are the sport's metrics from the database catalog
  (`codex/gemini-plan-contract` › Sport catalog): each has a key, a description
  used as the label, required or not, a value schema and a unit. Numbers get the
  keypad (decimal when fractions are allowed), booleans yes and no, string enums
  chips. A new sport needs a catalog row, not a screen: at most five metrics,
  usually time and distance, never calories.
- The metric that represents the session (`represents_session_duration`,
  stored in seconds) is typed in minutes and pre-filled from the plan, so a
  session done as planned is one tap. Nothing else is made up.
- **Choose file** sits at the top, where a map used to be: the system picker,
  one `.fit` or `.gpx` file, parsed on the phone (`activity-file-import.md`).
  Its numbers fill the fields (6.2); the person checks them and continues. The
  same row on every form, swims included.
- Continue goes to Completion & feedback (7). Notes there feed the description
  our assistant keeps of the person.

Gym steps are tracked one of two ways:

| Tracking | Used for | Planned as | Logged | Input |
| --- | --- | --- | --- | --- |
| `reps` | Strength exercises | `3 × 10`, bodyweight `2 × 8`, `2 × 8 each side` | reps and weight (kg, optional) per set | Steppers: reps from the plan, weight from last time (6.3) |
| `time` | Holds, stretches, warm-up walks | `3 × 20 s`, `5 min` | seconds per round | Countdown; **Done** ends a round early and logs the real time (6.5) |

- One exercise per screen. A set done as planned is one tap; change a number
  only if you did something different. Rest starts by itself after a set
  (default 60 s) and can be skipped or extended. The session plan sheet (6.6)
  lets you do exercises in any order.
- The plan sets sets and reps, never a weight: the contract's gym exercises
  have sets and repetitions only. The first set takes the weight from the
  person's last time with that exercise, named under the steppers ("Last time,
  Mon 12 Oct: 3 × 10 · 8 kg"); later sets carry the set before. With no history
  the weight starts empty.
- No exercise demos or videos: a name and one sentence describe each exercise.

Rules:

- Ending early saves what was done, and the session counts as done with its
  actual minutes (6.7). No current doc defines session outcomes; the removed
  feedback draft used `outcome: done` with `actual_minutes`.
- Summaries show what was done, never plan versus actual (6.8). An exercise
  not done reads "Not today". Logged numbers never change the plan by
  themselves.
- Effort uses the accent (the current set); rest uses `--recovery`. Every state
  is also named in text.
- Steppers change by the exercise's step: reps 1, dumbbells 2 kg. Tapping the
  number opens the numeric keypad (`inputMode="numeric"`, or `"decimal"` for
  km). Buttons are 44 px or larger.
- In the app, keep the screen awake during gym sessions and show the current
  countdown on the lock screen (iOS Live Activity, Android ongoing
  notification).

Not decided yet: the catalog rows themselves (Gemiński is mapping sports to
metrics). How a gym exercise's tracking way and rest come out of the contract,
which has sets and repetitions per exercise but no hold time. Logs need the
session's metric values with their source (typed or file), per-set entries and
the feedback answer; agree the shape in `packages/contracts` before building
these screens. Swim distance is typed in metres; a lengths helper (25 m, 50 m
or other; 33 m was dropped) waits to see whether swimmers need it.

## Chat

Chat answers one question: what should change? It is one conversation with our
assistant, titled **Coach**, reached from the chat button beside the tab bar (see
[Chat placement](#chat-placement)). A valid change becomes the active plan
straight away (docs/product.md, step 6). There is no confirm step, so every
change shows exactly what moved and offers **Undo**. Chat also moves a missed
session (8.15) and adds a workout done outside the plan (8.16), which replaced
the separate logging form.

Entry points: the chat button opens chat empty (8); the **Need a
change?** chips open it with the request filled in; **See the chat** on the Plan
updated note (5.4) opens the thread; **Ask in chat** on Not today (5.2) and
**Adjust** on an activity (6) attach that session (8.1); **Move it** on a missed
session (5.5) attaches it and offers free slots (8.15).

| Part | Shows |
| --- | --- |
| Change card | **Plan updated**, a one-line summary (the Gemini modify mode returns a `message`), then one row per changed session: the day it is on now, its title, and each changed value as old (struck through) → new. **New** and **Removed** labels; a swapped session shows its old title struck through above the new one; a sport switch adds a Sport row. Rows for what couldn't change give the reason. A lock line names what stays, then **Undo** and **See week** |
| Workout added | The sport and the day, then every field as saved, "Your plan stays as it is.", **Undo** and **Edit** |
| Reply | A coach message that changed nothing, always with "Plan unchanged" under it ("Nothing saved yet" under a question about a workout), and quick replies when a choice helps |
| Quiet option | The last and least prominent answer, an underlined text button. Used for skipping a missed session |
| Updating | Spinner, skeleton rows and "Your current plan stays as it is until the new one is ready." The message box is locked: one change at a time |
| Problem | Didn't work, or changed elsewhere. Both say the plan is as it was and offer **Try again** |
| Message box | "Changes apply straight away. You can undo.", the attached session, or the offline note |

| Frame | When |
| --- | --- |
| 8 | First open: what you can ask, including adding a workout. An example fills the box; nothing is sent until you send |
| 8.1 | Opened from a session, with quick replies |
| 8.2 | A change is running |
| 8.3 | Mornings and a shorter Friday, applied; Home 5.4 shows the result |
| 8.4 | Undone: the plan before the change is back |
| 8.5 | A session removed, then one added; the older card loses Undo |
| 8.6 | A sport switch swaps upcoming sessions only |
| 8.7 | Partly possible: moved to Saturday at 7:00, not 6:00, with the reason |
| 8.8 | Earlier changes folded by day; a request that changes nothing |
| 8.9 | A vague request: one question with quick answers |
| 8.10 | Done days and sports outside the catalog can't change |
| 8.11 | Pain or a health condition: no change, see a doctor, resting is fine |
| 8.12 | A timeout, a provider failure or a result that failed validation |
| 8.13 | The plan changed elsewhere while the request ran |
| 8.14 | Offline: the message waits, unsent |
| 8.15 | Move it from a missed session: free slots first, **Skip it this time** last |
| 8.16 | A workout done outside the plan, added in a sentence |

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
  change exists or a changed session has started.
- One request at a time. The plan in use stays active until the new one passes
  validation. A result built on an older version is never applied (8.13); Try
  again rebuilds on the latest one.
- Nothing half-applies. Failure, offline and stale all keep the plan and the
  message: **Try again** resends it, **Edit message** puts it back in the box.
- Requests outside the plan's rules get a reason and a nearby option, never a
  silent workaround: done days, sports outside the catalog, the 7:00–21:00
  window, 5, 10 or 20 minutes, beginner scope. One session per local date is the
  default; an explicit chat request can authorize multiple sessions for that
  modification, while free slots, buffers and protected workouts still apply
  (see the [Gemini contract](../docs/features/gemini-json-contract.md)). The valid part
  of a request still applies (8.7); an asked-for length snaps to the nearest
  allowed one below.
- A missed session (8.15): free slots inside the preferred window come first as
  quick replies; **Skip it this time** comes last, as a quiet link with "Nothing
  to make up." Nothing changes until one is picked, and a pick is a normal
  change with its card.
- A workout done outside the plan (8.16): said in a sentence. Only how long is
  ever asked, with "Nothing saved yet" under the question. The card shows every
  field as saved in the sport's metrics, so a misreading is easy to spot. It's
  history, not a plan session: the plan stays as it is, it doesn't count toward
  "2 of 3 done", and the Calendar shows it on its day with an **Extra** tag.
  **Undo** removes it; **Edit** opens the log-it form (6.1) filled in.
- No voice input in the MVP: the keyboard's dictation covers it.
- Health: no condition-specific changes and no advice beyond seeing a doctor or
  physio (docs/product.md, deferred decisions).
- Errors are announced (`role="alert"`); updating is `role="status"`. Spinner,
  shimmer and caret stop under reduced motion. Each message tells screen readers
  who said it ("You:" or "Coach:").

Not decided yet: `codex/gemini-plan-contract` gives chat a modify mode (the
conversation and the latest prompt in; add/delete operations and a message
out), which the change card can be built on; it can't shorten one session below
the preferred length on its own terms, and Undo still needs a backend call that
restores a version. The 7:00–21:00 window is a proposed rule; the docs only
prefer the morning, lunch and evening ranges. How long chat history is kept,
and whether folded cards reopen with their rows. Adding a workout needs its own
validated AI call and a log contract shared with the log-it form.

## Chat placement

Chat is where most changes happen, so it is always one tap away: a dark round
button level with the floating tab bar, on every tab. The bar holds Today ·
Calendar · You, with You last. Chat opens full screen over the tab you were on,
with no tab bar, and its back arrow returns there.

The review (3 October) drew two placements: chat as a fourth tab, or this
button. The team chose the button, which makes chat the main action, apart from
the tabs where you look things up, and gives the thread the full screen. The
tab variant is removed.

## Profile

The You tab answers one question: what do I prefer, and how does the app see
me? It keeps three layers apart:

| Layer | What it holds | Changed by | Stored as |
| --- | --- | --- | --- |
| Answers | The onboarding preferences | The person only | `PREFERENCES.md` fields, one JSON per person on the server; `timezone` comes from the phone |
| Feedback | "Would you choose this again?" per session, and whole activities switched off | The person only | A yes, maybe or no per session (no doc yet); `excluded_activity_types` |
| Summary | Our assistant's description of the two layers above | Rebuilt by the app | Statements that each reference stored facts; never the record |

The screens show Ana on Wednesday 21 October, week 3, with the sessions from
`home.jsx` and `calendar.jsx`:

- **You (9, and 9.1 in week 1):** the summary card, then one row per onboarding
  step and **Your feedback**. In week 1 the summary says what it doesn't know yet.
- **Summary (9.2, 9.3):** each statement names its source. Tapping one opens the
  stored facts behind it, with a way to change them.
- **Edit (9.4):** each row opens its onboarding step with the same pieces and
  `PREF_OPTIONS`, a back arrow instead of steps, and **Save** instead of
  Continue. 9.4 shows Time, with the two-handle window; the other steps keep
  their onboarding rules.
- **Your feedback (9.5):** yes, maybe and no, per card. **Try again** sets one
  card back to no opinion. **Reset feedback** asks first, then clears every
  opinion but keeps history, answers and switched-off activities, which list
  here with **Switch on**.
- **Settings (9.6):** behind the gear, kept apart from what shapes the plan:
  appearance (follow the phone, light or dark), the account and time zone,
  **Data and privacy**, the terms and privacy policy, and **Sign out**.
- **Data and privacy (9.7):** connections, and what our assistant sees: her
  answers and free times, her sessions with how they felt and her notes (they
  feed the short description it keeps of her), and whether she'd choose a
  session again. Never her name, email or steps.

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
and the plan generator doesn't read feedback at all. The description built from
notes maps to `user_description` in the Gemini contract; who writes it, and
when, is open. Switching off a whole activity is placed in a session's menu,
which no screen shows yet. Also open: Google Calendar as a second calendar
source (the device calendar is on `develop`), watch connections (the wearable
library on `develop` is server-side; shown as Later; `.fit`/`.gpx` import is
used in 6.1–6.10), notifications in Settings, and account download and deletion.
Each "What our assistant sees" line is a promise; check it against the backend
before shipping.

## Calendar

The Calendar tab answers one question: when are my sessions, and when were
they? It replaced the Plan tab in the review.

- **Calendar (10):** Wednesday 21 October, week 3. A month of sessions: a mark
  per session under its date (done filled, planned in the accent, skipped or a
  past session nobody logged a dashed ring) and each day's full label for
  screen readers. Tap a day for its sessions (an added workout carries
  **Extra**, an unlogged one **Not logged**), or the next session on a free
  day. Private events and what they contain never show, and the line under the
  day says so. The month pages back to the first session and stops at the last
  planned day: plans go one week ahead. **Plan history** is a section below,
  with the version in use.
- **Plan history (10.1):** one entry per version, newest first: where it came
  from (first plan, weekly plan, chat, undo), when, and its summary. Done
  sessions keep the version they were done in (docs/product.md).

Not decided yet: whether older versions can be opened in full, and whether a
past day's session opens its log or the activity.

## Porting notes

- Tokens are CSS variables; for Expo, translate `system/tokens/*.css` into a
  TypeScript theme (light + dark) rather than hard-coding values.
- Fonts: Bricolage Grotesque (display, numbers) and Hanken Grotesk (body), woff2
  in `system/fonts/`. Expo can load them via `expo-font` / `@expo-google-fonts`.
- Icons: Lucide (`lucide-react-native` on mobile, `lucide-react` on web). The
  Google mark on Welcome is the one brand asset; use Google's own.
- Styles are web-only in places (`color-mix`, `backdrop-filter`, CSS gradients);
  pick native equivalents when porting.
- Small controls (36 px buttons, 40 px tags, 24 px chip close) keep their look;
  give them `hitSlop` so every target reaches 44 pt.
- The two-handle window has no core React Native control: build it with
  Gesture Handler and Reanimated, two thumbs on one track, each an accessible
  adjustable element with increment and decrement actions.
- The Calendar month is a plain seven-column grid; it needs no calendar library.
- Status colours as text use `--success-text`, `--danger-text` and `--info-text`
  (4.5:1 or more on every surface); `--success`, `--danger` and `--info` are for
  icons, dots and borders.
