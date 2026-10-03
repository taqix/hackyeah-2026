import type { ExpoCalendar, ExpoCalendarEvent } from 'expo-calendar';

import { CalendarError } from './types';
import type { CalendarEvent, NewCalendarEvent } from './types';

type Platform = 'ios' | 'android';
type NativeEvent = Pick<ExpoCalendarEvent,
  'id' | 'calendarId' | 'title' | 'startDate' | 'endDate' | 'allDay' |
  'location' | 'notes' | 'availability' | 'status'>;

function fromNativeDate(value: string | Date, allDay: boolean, platform: Platform): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new CalendarError('native-error', 'The device returned an invalid event date.');
  }
  if (allDay && platform === 'android') {
    // Android stores calendar dates at UTC midnight, independent of the device zone.
    const local = new Date(date);
    local.setFullYear(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    local.setHours(0, 0, 0, 0);
    return local;
  }
  return date;
}

function toUtcCalendarDate(date: Date): Date {
  const utc = new Date(date);
  utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
}

export function mapExpoEvent(event: NativeEvent, platform: Platform): CalendarEvent {
  const startDate = fromNativeDate(event.startDate, event.allDay, platform);
  const endDate = fromNativeDate(event.endDate, event.allDay, platform);
  return {
    id: event.id,
    occurrenceKey: JSON.stringify([event.calendarId, event.id, startDate.toISOString()]),
    calendarId: event.calendarId,
    title: event.title ?? '',
    startDate,
    endDate,
    allDay: event.allDay,
    location: event.location ?? null,
    notes: event.notes ?? null,
    availability: event.availability ?? 'notSupported',
    status: event.status ?? 'none',
  };
}

export function toExpoEvent(
  event: NewCalendarEvent,
  platform: Platform,
): Parameters<ExpoCalendar['createEvent']>[0] {
  const androidAllDay = platform === 'android' && event.allDay;
  return {
    title: event.title,
    startDate: androidAllDay ? toUtcCalendarDate(event.startDate) : event.startDate,
    endDate: androidAllDay ? toUtcCalendarDate(event.endDate) : event.endDate,
    allDay: event.allDay ?? false,
    timeZone: androidAllDay ? 'UTC' : event.timeZone,
    endTimeZone: androidAllDay ? 'UTC' : event.timeZone,
    location: event.location,
    notes: event.notes,
  };
}
