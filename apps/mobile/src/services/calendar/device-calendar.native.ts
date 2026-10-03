import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { mapExpoEvent, toExpoEvent } from './expo-mapping';
import { createCalendarService } from './service';
import type { CalendarDriver } from './service';

const platform = Platform.OS === 'ios' ? 'ios' : 'android';

function isAvailable() {
  return (Platform.OS === 'ios' || Platform.OS === 'android') &&
    !isRunningInExpoGo() && requireOptionalNativeModule('CalendarNext') !== null;
}

// Loading lazily keeps the app usable in Expo Go and binaries built before this
// module was installed. Consumers receive an explicit unavailable permission.
const loadCalendar = () => import('expo-calendar');

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
    return calendars.map((item) => ({
      id: item.id,
      title: item.title,
      color: item.color,
      source: item.source.name,
      allowsModifications: item.allowsModifications,
      isVisible: item.isVisible,
    }));
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
};

export const deviceCalendar = createCalendarService(driver);
