# Mobile design review, 3 October 2026

The team walked through the mobile prototype in `design/` (onboarding, home,
workouts, chat and profile) and narrowed the MVP to three things done well: a
plan fitted to the person's calendar, the chat, and simple activity logging.
This page records what was agreed and how the design applies it. Where it
disagrees with an older doc, this page is newer.

## Decisions

- The MVP is beginner friendly. It rests on a plan fitted to the calendar and
  on the chat; finished features beat many shallow ones.
- XP and levels, tournaments and the friend hub are out of the current scope.
  They may come back as separate features once the core works.
- The Calendar tab shows sessions only. The app reads when the person is busy,
  never private events or what they contain.
- Calories are not an MVP metric.
- Plans are made one week ahead; history is kept in full.
- Custom screens per sport would widen the MVP. Every sport except the gym
  uses one logging form built from the sport's metrics in the database.
- Live tracking is for gym sessions only (sets, reps, weight). Everything else
  is logged afterwards, typed or imported from a `.fit` or `.gpx` file. No
  GPS, maps or Strava dependency: the app must work without other apps.
- The plan sets sets and reps for gym exercises. The weight is the person's,
  pre-filled from their last time, never generated.
- Where chat lives, a tab in the bar or a button beside it, needed a UX test.
  Both variants were drawn; the team then chose the button (see Next steps).

## Next steps

| Owner | Step | Design status |
| --- | --- | --- |
| Gemiński | Map sports to dynamic metrics in the database (at most five per sport; time and distance cover most; no calories) | The form reads the catalog shape from `codex/gemini-plan-contract`; the rows are not written yet |
| Team | Bring back Google Sign-In and simplify the start of onboarding | Done: Google, or one email field that signs in or creates the account (1–1.3) |
| Team | Remove the guest demo and everything tied to it from mobile | Done: no guest button, Home 5.15 or chat 8.15–8.16. The website demo keeps its guest plan |
| Team | Two-handle slider for the preferred hours | Done: one window, 7:00–21:00 (3.1, 9.4) |
| Team | Remove "Are you comfortable swimming?" | Done (3.3) |
| Team | Keep the avoided-activities question as a multi-checkbox only | Done: no "Nothing to avoid" (3.4) |
| Team | Plan one week ahead, keep the full history | Done: week arrows on Home (5, 5.6, 5.10) and the Calendar tab (10) |
| Team | Missed session: "Log it" and "Move it", with Move it opening chat | Done: Home 5.5 and chat 8.15, where skipping is the last option |
| Team | Chat placement: a button beside the tab bar, not a Chat tab | Done: Today · Calendar · You and a chat button on every tab; chat opens full screen with a back arrow. The tab variant and the board's switch are removed |

## Also agreed in the call

These came up in the transcript rather than the summary. The design applies
them.

| Area | Agreed | Where |
| --- | --- | --- |
| Places | Drop the "bike sessions need a bicycle" note | 3.3 |
| Good to know | "What usually makes starting difficult?" becomes a multi-checkbox too | 3.4 |
| Activities | Suggested sports, plus search with autocomplete over the sport catalog | 3.2 |
| Home | Drop the info notes ("Your first week", "A lighter week") as clutter; keep "Plan updated" | 5.4, 5.9 |
| Home | Drop the calendar-problem state with unscheduled sessions | was 5.11 |
| Home | Greeting follows the time of day | all Home frames |
| Home | Encouragement when a week is done, without hype | 5.6 |
| Home | Start opens the session; Not today and Need a change open chat | 5, 5.2 |
| Plan tab | Becomes a Calendar tab; plan history stays as a section | 10, 10.1 |
| Add a workout | No manual form. A workout done outside the plan is added in chat | 8.16 |
| Workouts | No live run screen and no map | was 6.1 |
| Workouts | `.fit` and `.gpx`, in lowercase, with the same import row everywhere | 6.1, 6.2, 6.9, 6.10 |
| Workouts | No exercise video in the gym screens | 6.3–6.8 |
| Workouts | Pool lengths 25 m, 50 m and other, not 33 m. Superseded by the shared form, where a swim logs time and distance | 6.9 |
| Feedback | Notes after a session feed the description our assistant keeps of the person | 7, 9.7 |
| Chat | No voice input (the keyboard has dictation) | — |
| Profile | Profile and settings are separate; settings sit behind the gear | 9.6, 9.7 |
| Profile | Answers are edited per section with the onboarding questions | 9.4 |
| Profile | Answers are stored on the server as one JSON per person | backend |

## Open

- The preference fields changed shape: `preferred_window` (one hour window, or
  null for any time), `starting_obstacles` (an array) and `activity_interests`
  as catalog sport IDs. `PREFERENCES.md` and the plan contract need updating.
- The sport catalog's contents and each sport's metrics (Gemiński).
- Whether swimmers need a lengths helper on the distance field.
- Exercise demos and videos, XP and the friend hub: later, as their own features.
