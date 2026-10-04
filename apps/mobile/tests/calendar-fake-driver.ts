import { mock } from 'node:test';

import { type CalendarDriver, createCalendarService } from '../src/services/calendar/service';
import type {
  CalendarEvent,
  CalendarEventPatch,
  CalendarPermission,
  DeviceCalendar,
  NewCalendarEvent,
} from '../src/services/calendar/types';

/** A device calendar held in memory, behind the real service: reads, writes and app calendars. */
export function memoryCalendar() {
  const state = {
    permission: { status: 'granted', canAskAgain: true } as CalendarPermission,
    calendars: [
      { id: 'personal', title: 'Personal', source: 'Local', allowsModifications: true },
    ] as DeviceCalendar[],
    events: [] as CalendarEvent[],
    nextId: 1,
  };
  const copy = (event: CalendarEvent): CalendarEvent => ({
    ...event,
    startDate: new Date(event.startDate),
    endDate: new Date(event.endDate),
  });
  const find = (id: string) => {
    const event = state.events.find((candidate) => candidate.id === id);
    if (!event) throw new Error(`No event ${id}`);
    return event;
  };

  const driver = {
    getPermission: mock.fn(async () => state.permission),
    requestPermission: mock.fn(async () => state.permission),
    listCalendars: mock.fn(async () => state.calendars.map((calendar) => ({ ...calendar }))),
    getEvents: mock.fn(async (ids: string[], start: Date, end: Date) =>
      state.events
        .filter((event) => ids.includes(event.calendarId) && event.startDate < end && event.endDate > start)
        .map(copy),
    ),
    createEvent: mock.fn(async (input: NewCalendarEvent) => {
      const id = `event-${state.nextId++}`;
      const event: CalendarEvent = {
        id,
        occurrenceKey: id,
        calendarId: input.calendarId,
        title: input.title,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        allDay: input.allDay ?? false,
        location: input.location ?? null,
        notes: input.notes ?? null,
        availability: 'busy',
        status: 'confirmed',
      };
      state.events.push(event);
      return copy(event);
    }),
    updateEvent: mock.fn(async (id: string, patch: CalendarEventPatch) => {
      const event = find(id);
      if (patch.title !== undefined) event.title = patch.title;
      if (patch.notes !== undefined) event.notes = patch.notes;
      if (patch.startDate) event.startDate = new Date(patch.startDate);
      if (patch.endDate) event.endDate = new Date(patch.endDate);
    }),
    deleteEvent: mock.fn(async (id: string) => {
      find(id);
      state.events = state.events.filter((event) => event.id !== id);
    }),
    createCalendar: mock.fn(async (title: string) => {
      const calendar: DeviceCalendar = {
        id: `calendar-${state.nextId++}`,
        title,
        source: 'Local',
        allowsModifications: true,
      };
      state.calendars.push(calendar);
      return { ...calendar };
    }),
    deleteCalendar: mock.fn(async (id: string) => {
      state.calendars = state.calendars.filter((calendar) => calendar.id !== id);
      state.events = state.events.filter((event) => event.calendarId !== id);
    }),
  } satisfies CalendarDriver;

  /** A busy commitment in a calendar the person keeps. */
  const addEvent = (overrides: Partial<CalendarEvent> & Pick<CalendarEvent, 'startDate' | 'endDate'>) => {
    const id = `event-${state.nextId++}`;
    state.events.push({
      id,
      occurrenceKey: id,
      calendarId: 'personal',
      title: 'Commitment',
      allDay: false,
      location: null,
      notes: null,
      availability: 'busy',
      status: 'confirmed',
      ...overrides,
    });
    return id;
  };

  /** Write calls only: a sync that changes nothing makes none. */
  const writes = () =>
    driver.createEvent.mock.callCount() +
    driver.updateEvent.mock.callCount() +
    driver.deleteEvent.mock.callCount() +
    driver.createCalendar.mock.callCount() +
    driver.deleteCalendar.mock.callCount();

  return { state, driver, addEvent, writes, service: createCalendarService(driver) };
}
