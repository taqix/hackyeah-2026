import { createCalendarService } from './service';

// Metro uses device-calendar.native.ts on iOS/Android. Web never loads Expo Calendar.
export const deviceCalendar = createCalendarService(null);
