import type { ActivitySample, ImportedActivity } from './types';

export function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function nonNegative(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

export function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function isoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  // Never interpret a timestamp without a timezone in the importing phone's zone.
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function coordinate(value: unknown, limit: number): number | null {
  const number = finiteNumber(value);
  return number !== null && Math.abs(number) <= limit ? number : null;
}

function distanceBetween(a: ActivitySample, b: ActivitySample): number | null {
  if (a.segmentIndex !== b.segmentIndex || a.latitude === null || a.longitude === null ||
      b.latitude === null || b.longitude === null) return null;
  const radians = Math.PI / 180;
  const lat = Math.sin((b.latitude - a.latitude) * radians / 2);
  const lon = Math.sin((b.longitude - a.longitude) * radians / 2);
  const h = lat * lat + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * lon * lon;
  return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function summarize(samples: ActivitySample[]): ImportedActivity {
  const startTime = samples[0]?.timestamp ?? null;
  const endTime = samples.at(-1)?.timestamp ?? null;
  const elapsed = startTime && endTime ? (Date.parse(endTime) - Date.parse(startTime)) / 1000 : null;
  let distance: number | null = null;
  for (let index = 1; index < samples.length; index++) {
    const part = distanceBetween(samples[index - 1], samples[index]);
    if (part !== null) distance = (distance ?? 0) + part;
  }
  return {
    name: null,
    sport: null,
    kind: 'activity',
    startTime,
    endTime,
    elapsedTimeSeconds: nonNegative(elapsed),
    timerTimeSeconds: null,
    distanceMeters: distance,
    distanceSource: distance === null ? null : 'coordinates',
    caloriesKcal: null,
    // Sampling rates vary; do not pretend an arithmetic sample mean is device HR.
    averageHeartRateBpm: null,
    maxHeartRateBpm: null,
    samples,
  };
}
