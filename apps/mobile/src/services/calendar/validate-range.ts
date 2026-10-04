import { CalendarError } from './types';

export function validateRange(startDate: Date, endDate: Date) {
  if (
    !(startDate instanceof Date) ||
    !(endDate instanceof Date) ||
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime()) ||
    startDate >= endDate
  ) {
    throw new CalendarError('invalid-input', 'Provide valid Dates with startDate before endDate.');
  }
}
