import type { WorkoutFileMetric as Metric } from '@hackyeah/contracts/workout-file';

export interface Warning {
  code: string;
  entity: string;
  message: string;
}
export type { WorkoutFileMetric as Metric } from '@hackyeah/contracts/workout-file';
export interface Sample {
  sourceIndex: number;
  timestamp: string | null;
  latitude: number | null;
  longitude: number | null;
  elevationM: number | null;
  distanceM: number | null;
  speedMps: number | null;
  heartRateBpm: number | null;
  cadence: { value: number | null; unit: string; context: string } | null;
  powerW: number | null;
  temperatureC: number | null;
  source: Record<string, unknown>;
}
export interface TimerEvent {
  sourceIndex: number;
  timestamp: string | null;
  event: string;
  eventType: string;
  source: Record<string, unknown>;
}
export interface Activity {
  id: string;
  name: string | null;
  sport: string | null;
  startTime: string | null;
  endTime: string | null;
  sourceSummary: Record<string, unknown>;
  segments: { id: string; samples: Sample[] }[];
  laps: { sourceIndex: number; source: Record<string, unknown> }[];
  events: TimerEvent[];
  summary: Record<string, Metric>;
}
export interface Extraction {
  schemaVersion: '1.0';
  source: { format: 'fit' | 'gpx'; sizeBytes: number };
  metadata: Record<string, unknown>;
  activities: Activity[];
  routes: { name: string | null; points: Sample[]; source: Record<string, unknown> }[];
  waypoints: { name: string | null; point: Sample }[];
  warnings: Warning[];
}
export interface Config {
  maxFileBytes: number;
  maxSamples: number;
  maxXmlDepth: number;
  maxGapSeconds: number;
  movementThresholdMps: number;
  cyclingThresholdMps: number;
  maxSpeedMps: number;
  elevationWindow: number;
  elevationThresholdM: number;
  maxVerticalSpeedMps: number;
}
export const DEFAULT_CONFIG: Readonly<Config> = Object.freeze({
  maxFileBytes: 10 * 1024 * 1024,
  maxSamples: 250_000,
  maxXmlDepth: 64,
  maxGapSeconds: 30,
  movementThresholdMps: 0.3,
  cyclingThresholdMps: 1,
  maxSpeedMps: 100,
  elevationWindow: 3,
  elevationThresholdM: 3,
  maxVerticalSpeedMps: 10,
});
export class ExtractionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}
