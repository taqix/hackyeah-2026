import { addDays, atLocalTime, startOfWeek, toLocalDate } from '@/lib/dates';

export type TimeTravelOption = {
  label: string;
  /** Where to jump from the current demo time; null returns to the device clock. */
  target: (from: Date) => Date | null;
};

/** Relative to the demo's own "now", so pressing again keeps moving forward. */
export const TIME_TRAVEL: TimeTravelOption[] = [
  { label: 'Real time', target: () => null },
  { label: 'Tomorrow 8:00', target: (from) => atLocalTime(addDays(toLocalDate(from), 1), 8) },
  { label: 'This Sunday 19:00', target: (from) => atLocalTime(addDays(startOfWeek(from), 6), 19) },
  { label: 'Next Monday 8:00', target: (from) => atLocalTime(addDays(startOfWeek(from), 7), 8) },
];
