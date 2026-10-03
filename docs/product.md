# Product plan

## Goal and audience

Help an inactive adult who feels unsure where to start choose a sport and
complete an encouraging first activity. The goal is beginner participation and
general wellbeing. Professional training and treatment recommendations are
outside the current scope.

## MVP journey

The 3 October review ([mobile-review-2026-10-03.md](mobile-review-2026-10-03.md))
narrowed the MVP to a plan fitted to the calendar, the chat, and simple logging.

1. Continue with Google, or with an email address: one field signs in when the
   account exists and creates it otherwise. The web dashboard also has a guest
   button; the mobile app does not.
2. Complete a questionnaire and choose preferences.
3. Receive sport suggestions based on those preferences and choose a sport.
4. Receive an AI-generated beginner plan for the coming week, fitted to free
   time in the person's calendar.
5. Follow an activity, record completion, and report how it felt. Gym sessions
   are tracked set by set; any other sport is logged afterwards on one form
   built from the sport's metrics, typed or filled from a `.fit` or `.gpx` file.
6. Chat to change the plan. A valid revision immediately becomes the active plan;
   there is no separate acceptance step. Chat also moves a missed session and
   adds a workout done outside the plan.

Sports come from a database catalog. Each non-gym sport defines a few metrics
(at most five; time and distance cover most), so adding a sport means adding a
row, not a screen. Gym sessions are exercises with sets and repetitions. The
catalog's contents are being prepared; until then gym, fitness, running and
football are the working sports, and others can appear as clearly marked
previews without implying that their activity generation is available.

## Clients

- **Mobile:** primary experience, React Native with Expo. The mobile collaborator
  owns its setup; an Expo SDK 57 starter already exists on `develop`. Run locally
  on collaborators' machines for judging.
- **Web:** React marketing pages plus a dashboard supporting the same core journey.
  Provide fast guest entry for demonstrations.
- **Backend:** NestJS with TypeScript, shared by both clients.

## Accounts and guest demo

Supabase Auth supplies Google sign-in, email/password and, for the web demo,
anonymous identities. The mobile app has no guest entry. On the web, the guest
button creates an isolated anonymous identity and idempotently seeds demo
preferences, a plan, and activity history. Never use a shared guest login.

Preferences are stored on the server, one JSON document per person, so they
follow the account to a new phone.

Guest visitors can explore the core journey, including plan changes, without
altering another visitor's data. Apply limits to guest AI use. Define retention
and cleanup before a public launch; guest-to-permanent account conversion is
not required for the first MVP.

## Plan generation and revisions

NestJS owns AI provider integration. The provider and model are TBD; clients
consume a stable application API rather than provider-specific responses.

Return structured plans and validate them against the application contract before
saving. The server checks supported sport, plan shape, activity identifiers,
schedule consistency, and beginner scope. Invalid or failed generation leaves
the current plan intact and returns a useful retry state. Initial generation
failure must not leave a partial active plan.

Plans cover one week ahead: the next week is planned at the end of the current
one, so a changing calendar is read as late as possible. History is kept in full.

Save every accepted generation as a new version and replace the active version
atomically. Preserve completed activity records and the plan version to which
they belong. Prevent stale simultaneous requests from silently overwriting a
newer version. Chat receives a concise explanation of what changed.

## Out of scope for the MVP

Agreed in the 3 October review:

- XP and levels, tournaments, and a friend hub.
- Calories, and live tracking outside the gym (GPS, maps, a running screen).
- Exercise demo videos, a manual workout form, and voice input in chat.
- Custom screens per sport.
- Showing private calendar events or their contents.

## Deferred decisions

- AI provider/model, questionnaire fields, and sport-suggestion logic.
- Illness-specific chat behavior: define in a dedicated feature before implementing
  condition-dependent changes or claiming this capability in the demo.
- Hosting provider, budget, and implementation deadline.
- Public-launch retention, guest cleanup, and account lifecycle details.

## MVP acceptance targets

- A new user can register and complete the questionnaire-to-activity journey.
- Each of the four working sports has a usable beginner plan.
- Completion and feedback survive a reload for an authenticated user.
- A chat revision updates the active plan immediately after successful validation.
- A failed revision preserves the active plan and completed activity history.
- Web guest entry works in one action and guest data stays isolated.
- Web and mobile use the same backend contracts and account ownership rules.
- Preview sports are distinguishable from working MVP sports.
