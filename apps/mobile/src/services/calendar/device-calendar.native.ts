import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { mapExpoEvent, toExpoEvent } from './expo-mapping';
import { createCalendarService } from './service';
import type { CalendarDriver } from './service';
import type { DeviceCalendar } from './types';

const platform = Platform.OS === 'ios' ? 'ios' : 'android';
/** The app's accent (theme blue500), so exported sessions read as ours. */
const APP_CALENDAR_COLOR = '#3E74C4';

function isAvailable() {
  return (Platform.OS === 'ios' || Platform.OS === 'android') &&
    !isRunningInExpoGo() && requireOptionalNativeModule('CalendarNext') !== null;
}

// Loading lazily keeps the app usable in Expo Go and binaries built before this
// module was installed. Consumers receive an explicit unavailable permission.
const loadCalendar = () => import('expo-calendar');
type ExpoCalendarModule = Awaited<ReturnType<typeof loadCalendar>>;

function toDeviceCalendar(item: InstanceType<ExpoCalendarModule['ExpoCalendar']>): DeviceCalendar {
  return {
    id: item.id,
    title: item.title,
    color: item.color,
    source: item.source.name,
    allowsModifications: item.allowsModifications,
    isVisible: item.isVisible,
  };
}

/** iOS sources to try for a new calendar: the default calendar's, then the local one. */
function iosSourceIds(calendar: ExpoCalendarModule): string[] {
  const ids: (string | undefined)[] = [];
  try {
    ids.push(calendar.getDefaultCalendarSync().source.id);
  } catch {
    // No default calendar (or none readable): fall back to the local source.
  }
  try {
    ids.push(calendar.getSourcesSync().find((source) => source.type === calendar.SourceType.LOCAL)?.id);
  } catch {
    // Sources unavailable; the native default applies.
  }
  return [...new Set(ids.filter((id): id is string => !!id))];
}

const driver: CalendarDriver = {
  async getPermission() {
    if (!isAvailable()) return { status: 'unavailable', canAskAgain: false };
    const calendar = await loadCalendar();
    const permission = await calendar.getCalendarPermissions(false);
    return { status: permission.status, canAskAgain: permission.canAskAgain };
  },
  async requestPermission() {
    const calendar = await loadCalendar();
    const permission = await calendar.requestCalendarPermissions(false);
    return { status: permission.status, canAskAgain: permission.canAskAgain };
  },
  async listCalendars() {
    const calendar = await loadCalendar();
    const calendars = await calendar.getCalendars(calendar.EntityTypes.EVENT);
    return calendars.map(toDeviceCalendar);
  },
  async getEvents(ids, startDate, endDate) {
    const calendar = await loadCalendar();
    // Include UTC-encoded Android all-day dates before mapping to local days.
    const padding = platform === 'android' ? 24 * 60 * 60 * 1000 : 0;
    const events = await calendar.listEvents(
      ids,
      new Date(startDate.getTime() - padding),
      new Date(endDate.getTime() + padding),
    );
    return events.map((event) => mapExpoEvent(event, platform));
  },
  async createEvent(input) {
    const calendar = await loadCalendar();
    const target = await calendar.ExpoCalendar.get(input.calendarId);
    const event = await target.createEvent(toExpoEvent(input, platform));
    return mapExpoEvent(event, platform);
  },
  async updateEvent(eventId, patch) {
    const calendar = await loadCalendar();
    const event = await calendar.ExpoCalendarEvent.get(eventId);
    // Send only the fields that change: a null would clear one natively.
    const details = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    await event.update(details);
  },
  async deleteEvent(eventId) {
    const calendar = await loadCalendar();
    const event = await calendar.ExpoCalendarEvent.get(eventId);
    await event.delete();
  },
  async createCalendar(title) {
    const calendar = await loadCalendar();
    if (platform === 'android') {
      const created = await calendar.createCalendar({
        title,
        name: title.toLowerCase(),
        color: APP_CALENDAR_COLOR,
        source: { isLocalAccount: true, name: title, type: calendar.SourceType.LOCAL },
        ownerAccount: title,
        accessLevel: calendar.CalendarAccessLevel.OWNER,
        isVisible: true,
        isSynced: true,
      });
      return toDeviceCalendar(created);
    }
    const sourceIds = iosSourceIds(calendar);
    let lastError: unknown = null;
    // Some default sources (an Exchange account, say) refuse new calendars.
    for (const sourceId of sourceIds.length > 0 ? sourceIds : [undefined]) {
      try {
        const created = await calendar.createCalendar({
          title,
          color: APP_CALENDAR_COLOR,
          entityType: calendar.EntityTypes.EVENT,
          sourceId,
        });
        return toDeviceCalendar(created);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  },
  async deleteCalendar(calendarId) {
    const calendar = await loadCalendar();
    const target = await calendar.ExpoCalendar.get(calendarId);
    await target.delete();
  },
};

export const deviceCalendar = createCalendarService(driver);
