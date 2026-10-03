import { z } from 'zod';
import type { Activity, Sample, Warning } from './types.js';

export function numeric(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    (typeof value !== 'number' && typeof value !== 'string') ||
    String(value).trim() === ''
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function nonnegative(value: unknown): number | null {
  const n = numeric(value);
  return n !== null && n >= 0 ? n : null;
}
export function warn(warnings: Warning[], code: string, entity: string, message: string): void {
  warnings.push({ code, entity, message });
}
export function time(value: unknown, warnings: Warning[], entity: string): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (
    typeof value !== 'string' ||
    !z.iso.datetime({ offset: true, local: true }).safeParse(value).success
  ) {
    warn(warnings, 'invalid_timestamp', entity, 'Timestamp could not be decoded.');
    return null;
  }
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    warn(
      warnings,
      'timezone_missing',
      entity,
      'Timestamp has no timezone; offset was not assumed.',
    );
    return value;
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    warn(warnings, 'invalid_timestamp', entity, 'Timestamp could not be decoded.');
    return null;
  }
  return new Date(ms).toISOString();
}
export function epoch(value: string | null): number | null {
  if (!value || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms / 1000 : null;
}
export function seconds(a: string | null, b: string | null): number | null {
  const x = epoch(a),
    y = epoch(b);
  return x !== null && y !== null ? y - x : null;
}
export function jsonSafe(value: unknown): unknown {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return numeric(value);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  return value;
}
export function sample(
  index: number,
  value: Record<string, unknown>,
  warnings: Warning[],
  entity: string,
): Sample {
  let lat = numeric(value.latitude),
    lon = numeric(value.longitude);
  if (
    (lat !== null || lon !== null) &&
    (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180)
  ) {
    warn(warnings, 'invalid_coordinates', entity, 'Coordinate pair excluded from normalized data.');
    lat = lon = null;
  }
  return {
    sourceIndex: index,
    timestamp: time(value.timestamp, warnings, entity),
    latitude: lat,
    longitude: lon,
    elevationM: numeric(value.elevationM),
    distanceM: nonnegative(value.distanceM),
    speedMps: nonnegative(value.speedMps),
    heartRateBpm: nonnegative(value.heartRateBpm),
    powerW: nonnegative(value.powerW),
    temperatureC: numeric(value.temperatureC),
    cadence: null,
    source: jsonSafe(value.source ?? {}) as Record<string, unknown>,
  };
}
export function activity(
  id: string,
  name: string | null = null,
  sport: string | null = null,
): Activity {
  return {
    id,
    name,
    sport,
    startTime: null,
    endTime: null,
    sourceSummary: {},
    segments: [],
    laps: [],
    events: [],
    summary: {},
  };
}
export function geodesic(a: Sample, b: Sample): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null)
    return null;
  const rad = (v: number) => (v * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
