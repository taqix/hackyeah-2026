# Feature: calendar availability

Status: ready for review (device verification pending)
Owner: mobile

## Problem and user outcome

Planning code needs free time between two dates without handling raw calendar
events. `CalendarAvailabilityService` returns maximal free intervals using the
existing [device calendar API](device-calendar.md).

## Scope

- Included: an injectable abstraction, a ready-to-use device implementation,
  calendar selection, and free-slot calculation over a date range.
- Included since the Supabase integration: the daily window, a minimum slot
  length, and upload as the product API's `availability` (see
  [Plan availability](#plan-availability)). The connection UI is on Review and
  Data and privacy.
- Deferred: travel buffers and booking a slot.
- Affected area: mobile services only; no HTTP contracts or database changes.

## Acceptance criteria

- [x] A valid range returns sorted, non-overlapping free intervals within its bounds.
- [x] Overlapping, nested, duplicate, and adjacent commitments are combined.
- [x] Canceled, explicitly free, and zero-length events do not block time.
- [x] All-day events (such as holidays) are ignored by default; callers can opt in
      to blocking them with `blockAllDayEvents: true`.
- [x] Other timed occurrences block time, including tentative events.
- [x] Invalid ranges fail before calendar access; read errors propagate unchanged.
- [x] No permission prompts, writes, account-dependent behavior, or personal-data logs.
- [x] The public entry point remains importable outside native platforms and
      reports `unavailable` instead of claiming the calendar is empty.
- [ ] Availability compared with real iOS/Android device calendars.

Checked criteria have CPU test coverage, not physical-device verification.

## Design and compatibility

```ts
import { deviceCalendarAvailability, type CalendarFreeSlot } from '@/services/calendar';

// After the user has connected their calendar through deviceCalendar.requestPermission().
const slots: CalendarFreeSlot[] = await deviceCalendarAvailability.getFreeSlots({
  startDate: new Date('2026-10-05T09:00:00+02:00'),
  endDate: new Date('2026-10-05T17:00:00+02:00'),
  // calendarIds: selectedIds, // Omit to read all available event calendars.
  // blockAllDayEvents: true, // Optional: also block all-day commitments.
});

// With busy events 10:00–11:00 and 14:00–15:30 in the same zone:
// slots = [09:00–10:00, 11:00–14:00, 15:30–17:00]
// Each slot is { startDate: Date, endDate: Date }.
```

`CalendarAvailabilityService.getFreeSlots(query: CalendarAvailabilityQuery)` returns
`Promise<CalendarFreeSlot[]>`. `createCalendarAvailabilityService(calendar)`
accepts any `Pick<CalendarService, 'getEvents'>` for alternate implementations
and tests. `deviceCalendarAvailability` wires it to the existing platform-aware
`deviceCalendar`; the underlying API remains unchanged.

Both query and result intervals use `[startDate, endDate)`. Dates must be finite
`Date` objects with start before end. Inputs are snapshotted before asynchronous
reads. Returned dates are independent objects, and source events are not mutated.

The service clips busy events to the query, orders them, and returns the gaps in
their union. An empty calendar produces one slot covering the whole query; a
fully occupied range produces `[]`. A multi-day free interval stays in one piece,
including nights. There is no implicit daily schedule or minimum slot duration.

`availability: 'free'` and `status: 'canceled'` take precedence over other flags.
All-day entries, including holidays and birthdays, are ignored by default even
when their availability is busy or unsupported. Set `blockAllDayEvents: true`
to treat all-day commitments as busy too; free and canceled entries remain ignored.
This is an explicit all-day policy, not classification by event title.
When included, all-day dates use the existing adapter's local-midnight conversion,
including 23-hour and 25-hour days.

Unknown/unsupported availability for included events is treated as busy.
Recurring occurrences use their individual dates; shared event IDs do not
collapse separate commitments. A zero-length event consumes no time.

Calendar selection and permission checks are delegated to `getEvents`.
`calendarIds: []` yields the whole range as free after the underlying access
check. An absent calendar selection uses all calendars readable through that API;
Android's existing visible-calendar limitation still applies. Permission denial,
an unavailable module, stale selections, and native failures retain their
`CalendarError` code and details. They never turn into an empty calendar result.

OS access belongs to the installation, for both guests and signed-in users.
Callers own loading/error/retry UI and must request access from an explicit user
action as described in the device calendar guide. This service does not reserve
time; consumers needing current availability should query again before scheduling.

## Plan availability

`captureAvailability(options)` (`services/calendar/plan-availability.ts`)
builds the `availability` sent with plan generation and chat. Each caller
captures once per action and reuses the result when it retries.

```ts
const availability = await captureAvailability(
  {
    weekStart: '2026-10-05', // Monday of the planned week
    from: new Date(),        // first plan: now; chat: the week's local midnight
    window: preferences.preferred_window, // null means 7–21
    minMinutes: 5,           // optional
    timeZone: 'Europe/Warsaw', // optional: the plan's zone, for Google free/busy
  },
  { google }, // optional FreeTimeSource: Google Calendar when connected for planning
);
// { source: 'google_calendar' | 'device_calendar' | 'manual', captured_at, slots: [{ start_at, end_at }] }
```

- **Range:** from `from` (rounded up to 5 minutes) or the week's local
  midnight, whichever is later, to the next Monday's local midnight.
- **Google Calendar first**, when a `google` source is passed (the remote
  adapter passes one while Google Calendar is connected with "Use for
  planning" on):
  - Its free time over the range comes from Google's free/busy for the
    primary calendar (`services/google-calendar/free-busy.ts`). It never
    reads event titles or details.
  - `toDailySlots` cuts it exactly like the device's below.
  - The source is `google_calendar`. A fully busy week is a valid `[]`.
  - Any failure (offline, a refused or expired token, a Google error) falls
    through to the device read, then manual. A failed Google read is never
    sent as an empty `google_calendar` result.
- **With access:** `getFreeSlots` reads every calendar except the "Movo"
  export calendar and any `excludeCalendarIds`. All-day events do not block.
  - `toDailySlots` intersects the free time with each local day's window,
    built from wall-clock hours, so DST days keep 7:00–21:00.
  - Slots shorter than `minMinutes` are dropped; at most 100 are kept, sorted.
  - The source is `device_calendar`. A fully busy week is a valid `[]`.
- **Denied, undetermined or unavailable** (web, Expo Go), including access
  revoked during the read: `manual` slots, one window per day.
- **Any other read error** (`native-error`) rejects, so a failed read never
  goes out as an empty device calendar.
- Times are ISO 8601 with the device's offset. `captured_at` uses the device
  clock, never the demo override.

## Verification

- `npm run test:calendar --workspace=@hackyeah/mobile`: 77 tests pass in each of
  `Europe/Warsaw` and `America/Los_Angeles`.
  - 18 cover free slots.
  - `tests/calendar-plan-availability.test.ts` covers day splitting, the
    window, DST weeks, the minimum length, the 100-slot cap, excluded
    calendars, the manual fallbacks and a native failure.
  - `tests/google-calendar.test.ts` covers Google free/busy into slots, DST
    weeks, the fallbacks after a failed Google read, and the Google export.
- `npm run typecheck`: passes for all workspaces and the mobile test graph.
- `npm run lint`: passes for all workspaces.
- New files formatted with `packages/.prettierrc.json`; `git diff --check` passes.

Device smoke check remains pending: connect a disposable calendar in a native
development build, add overlapping events plus a canceled/free and an all-day
event, query the surrounding range, and compare slots with the OS calendar.
Confirm the all-day event blocks only with `blockAllDayEvents: true`.
Revoke access and confirm the request fails instead of reporting the range free.
Then build a plan with the calendar connected and check that no session lands
on a busy time. No native binary was built and no real calendar data was
accessed for this change.

## Deployment and rollback

No new dependencies, permissions, configuration, or migrations. Requires the same
native calendar module as the existing API. Remove the availability caller and
exports to roll back; the service never changes OS events.

## Review and documentation

- [x] Public API, blocking policy, errors, limitations, and checks documented.
- [x] Examples and tests use synthetic events only.
- [ ] Device acceptance evidence and one teammate approval before merge.
