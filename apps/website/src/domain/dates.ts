/* Local-midnight date arithmetic and formatting. Every function takes the dates it needs,
   so nothing here reads the clock and all of it is testable with fixed dates. */

export const DAYS_IN_WEEK = 7;

/** For the one case that needs to keep the time of day while moving whole days. */
export const MS_PER_DAY = 86_400_000;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function weekdayName(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

export function weekdayShortName(date: Date): string {
  return WEEKDAYS_SHORT[date.getDay()];
}

export function weekdayInitial(date: Date): string {
  return weekdayName(date).charAt(0);
}

/** Day index (0 = Sunday) for a lowercase weekday name, or -1 when it is not one. */
export function weekdayIndexOf(lowercaseName: string): number {
  return WEEKDAYS.findIndex(day => day.toLowerCase() === lowercaseName);
}

/** "7 Oct" */
export function formatDayAndMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "Wed 7 Oct" */
export function formatWeekdayAndDate(date: Date): string {
  return `${weekdayShortName(date)} ${formatDayAndMonth(date)}`;
}

/** "Wednesday 7 October" */
export function formatFullDate(date: Date): string {
  return `${weekdayName(date)} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** The seven days from `start`: "5–11 Oct", or "28 Sep – 4 Oct" across a month boundary. */
export function formatWeekRange(start: Date): string {
  const end = addDays(start, DAYS_IN_WEEK - 1);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
    : `${formatDayAndMonth(start)} – ${formatDayAndMonth(end)}`;
}
