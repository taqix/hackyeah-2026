# Feature: device calendar access

Status: ready for review (device verification pending)
Owner: mobile

## Problem and user outcome

Upcoming planning screens need to read existing commitments over a chosen period
and add an activity to a user's OS calendar. `@/services/calendar` provides the
mobile abstraction without exposing Expo shared objects to callers.

## Scope

- Included: full calendar permissions, calendar discovery, range reads, and adding
  one-time timed or all-day events on iOS and Android.
- Deferred: calendar UI, automatic plan export, recurring event creation,
  edits/deletions, background sync, free-slot calculation, and backend upload.
- Affected area: mobile only. No API contracts or database changes.

## Acceptance criteria

- [x] Permission checks do not prompt; the caller explicitly requests permission.
- [x] Missing permissions, an unavailable module, invalid inputs, missing/read-only
  calendars, and native failures are distinguishable.
- [x] Range reads include overlapping, all-day, and recurring occurrences;
  results are sorted, with a separate key for each occurrence.
- [x] An explicit empty calendar filter returns no events.
- [x] Only a chosen writable calendar can receive an event; invalid writes are
  rejected before the native operation, and failed writes are not retried.
- [x] Web, Expo Go, and native binaries without CalendarNext remain importable
  and report unavailable access.
- [ ] Native permission dialogs and read/write behavior verified on real devices.

These checked criteria have source/CPU verification, not a live device result.

## Setup and compatibility

`expo-calendar ~57.0.5` matches Expo SDK 57. The config plugin in
`apps/mobile/app.json` adds Android READ/WRITE_CALENDAR and iOS full calendar
access descriptions. Reminders access is disabled. Rebuild after adding the
module or changing native permissions; an OTA JS update is insufficient.

From `apps/mobile`, with the corresponding native toolchain installed:

```sh
npx expo run:ios --device
# Or, on an Android device:
npx expo run:android --device
```

Expo Go does not support this version of expo-calendar. The existing root
`npm run ios` / `npm run android` commands only start/open Metro; they do not
compile a new native binary. Keep generated native projects out of this change.

The module uses the current Expo API (`listEvents`, `ExpoCalendar.createEvent`,
etc.), not the deprecated `*Async` names. See the
[Expo calendar documentation](https://docs.expo.dev/versions/latest/sdk/calendar/).

## API and usage

```ts
import { CalendarError, deviceCalendar } from '@/services/calendar';

// From a user action such as "Connect calendar":
const permission = await deviceCalendar.requestPermission();
if (permission.status !== 'granted') {
  // Show unavailable, denied, or undetermined UI.
  // If denied and !canAskAgain, offer React Native Linking.openSettings().
  return;
}

const calendars = await deviceCalendar.listCalendars();
const events = await deviceCalendar.getEvents({
  startDate: new Date('2026-10-05T00:00:00+02:00'),
  endDate: new Date('2026-10-12T00:00:00+02:00'),
  // calendarIds: selectedIds, // Omit for all OS-readable event calendars.
});

const writableCalendars = await deviceCalendar.listCalendars({ writableOnly: true });
// Let the user choose a calendar; handle an empty writableCalendars array.
// After they confirm the activity and chosenCalendarId:
try {
  const saved = await deviceCalendar.createEvent({
    calendarId: chosenCalendarId,
    title: 'Beginner walk',
    startDate: new Date('2026-10-05T17:00:00+02:00'),
    endDate: new Date('2026-10-05T17:30:00+02:00'),
    timeZone: 'Europe/Warsaw',
    notes: 'An easy 30-minute walk.',
  });
  // Store saved.id/calendarId if the feature needs a local export reference.
} catch (error) {
  if (error instanceof CalendarError) {
    // Map error.code to UI and an intentional retry/settings action.
    // error.permission includes canAskAgain for permission-denied.
  }
}
```

All operations are promises; the consuming screen owns its loading/error state.
`getPermission()` refreshes the OS state without displaying a dialog. Each read
or write checks current permission again, so revocation in Settings is detected.
Read/write calls never request permission themselves. Full access is required;
iOS write-only permission does not meet the read requirement.

`getEvents` uses `[startDate, endDate)`: it includes events that overlap the
interval and point events at its start, and excludes events ending at its start
or beginning at its end. Dates must be finite `Date` objects with start < end.
Dates returned describe the full occurrence; they are not clipped to the query.
Long ranges are fetched in yearly chunks to avoid EventKit's four-year query
limit. Repeated occurrences share `id` on some platforms; use `occurrenceKey`
as the list key. It is a snapshot key, not a permanent external identifier.

For an all-day write, pass `allDay: true` and device-local midnights with an
exclusive end, for example `new Date(2026, 9, 5)` to `new Date(2026, 9, 6)`.
Do not construct these dates with a date-only ISO string (which means UTC).
The Android adapter converts between local calendar dates and the required UTC
midnight storage; it also sets both native time zones to UTC. Timed dates are
absolute instants; their optional `timeZone` must be a valid IANA zone.

Native reads preserve availability and canceled status; a consumer deciding
which events block time must account for both. This module does not classify
every event as busy. Android's Expo API only reads visible calendars, even with
explicit IDs; `DeviceCalendar.isVisible` exposes that native flag. Calendars and
events must already exist/sync on the device; this is not a cloud calendar API.

No arbitrary default calendar is chosen and no calendar is created automatically.
An empty calendar list is a valid state. Calendar titles and event details stay
on the device: the service neither logs them nor sends them to NestJS/AI. OS
permissions belong to the app installation, not a Supabase account. Guest and
signed-in users therefore require the same explicit OS connection action; a
future screen must not auto-connect guests or auto-export generated plans.

Errors: `unavailable`, `permission-denied`, `invalid-input`, `calendar-not-found`,
`calendar-read-only`, `native-error`. Native errors retain their original
`cause` for diagnostics; avoid logging personal calendar data. A failed write
can be ambiguous if the OS saved before reporting failure, so check the calendar
before retrying rather than creating duplicates automatically.

## Verification

Completed locally:

- `npm run typecheck`: passes for the app and isolated Node test graph.
- `npm run lint`: passes.
- `npm run test:calendar --workspace=@hackyeah/mobile`: 17 CPU tests pass in
  each of Europe/Warsaw and America/Los_Angeles. Covers permissions/revocation,
  range boundaries, recurrence keys, chunk deduplication, invalid writes,
  uncertain-save errors, and all-day UTC/local conversion across DST.
- `npx expo config --type introspect --json` in `apps/mobile`: verified both
  iOS calendar descriptions and Android READ/WRITE_CALENDAR; no reminders keys.
- Metro `npx expo export:embed --entry-file .expo/calendar-bundle-check.js
  --platform <ios|android|web> --dev false --bundle-output /tmp/hackyeah-calendar-<platform>.js`:
  all three bundles pass. The temporary entry imported and logged
  `deviceCalendar` from `../src/services/calendar`; it was removed afterwards.
  The web bundle excludes CalendarNext and executes in Node without native imports.

These are CPU, configuration, and JavaScript bundling checks. No native app binary
was compiled, and no actual OS events were accessed or created.

Device smoke test (pending; use a disposable test calendar):

1. Check access before asking: no dialog. Request it from an explicit action;
   test allowing, denying, and denying permanently/settings recovery.
2. List calendars, including one read-only and one writable. Confirm selections.
3. Read a week containing a spanning event, recurrence, all-day event, and an
   event exactly at each boundary. Compare times with the OS calendar app.
4. Add a timed activity to the selected calendar; verify its title, notes, and
   times in the OS app, then re-read the interval. Repeat with an all-day event
   across a daylight-saving transition.
5. Revoke permission in Settings and retry: receive permission-denied. Confirm
   empty and read-only calendars do not trigger an accidental write elsewhere.
6. In Expo Go/web, verify an unavailable state; no calendar prompt or data access.

The repository still contains a starter UI. There is no calendar screen to run
these steps from yet; invoke the service from the consuming screen or a temporary
development harness. The full sign-in/plan/chat smoke journey is not implemented.

## Deployment and rollback

Rebuild the native app before adopting the API in a screen. There are no database
migrations or backend release dependencies. Rollback the JS caller and dependency/
plugin together and rebuild. Previously added OS events remain user data; a
rollback must not delete them.

## Review and documentation

- [ ] Device acceptance evidence and one teammate approval before merge.
- [x] Feature setup, public API, limitations, and smoke steps documented.
- [x] No secrets or real personal calendar data in examples or tests.
