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
- Deferred: UI, working/sleep hours, minimum activity duration, travel buffers,
  booking a slot, and backend upload.
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

## Verification

- `npm run test:calendar --workspace=@hackyeah/mobile`: 35 tests pass in each of
  `Europe/Warsaw` and `America/Los_Angeles` (18 new availability tests).
- `npm run typecheck`: passes for all workspaces and the mobile test graph.
- `npm run lint`: passes for all workspaces.
- New files formatted with `packages/.prettierrc.json`; `git diff --check` passes.

Device smoke check remains pending: connect a disposable calendar in a native
development build, add overlapping events plus a canceled/free and an all-day
event, query the surrounding range, and compare slots with the OS calendar.
Confirm the all-day event blocks only with `blockAllDayEvents: true`.
Revoke access and confirm the request fails instead of reporting the range free.
No native binary was built and no real calendar data was accessed for this change.

## Deployment and rollback

No new dependencies, permissions, configuration, or migrations. Requires the same
native calendar module as the existing API. Remove the availability caller and
exports to roll back; the service never changes OS events.

## Review and documentation

- [x] Public API, blocking policy, errors, limitations, and checks documented.
- [x] Examples and tests use synthetic events only.
- [ ] Device acceptance evidence and one teammate approval before merge.
