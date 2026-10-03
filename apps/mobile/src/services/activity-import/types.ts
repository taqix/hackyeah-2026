export type ActivityFileFormat = 'fit' | 'gpx';

/** JSON-safe values; unknown measurements are null, never invented zeroes. */
export interface ActivitySample {
  /** ISO 8601 UTC, or null when the source has no timestamp. */
  timestamp: string | null;
  /** Points in different segments must not be joined on a map. */
  segmentIndex: number;
  latitude: number | null;
  longitude: number | null;
  altitudeMeters: number | null;
  distanceMeters: number | null;
  speedMetersPerSecond: number | null;
  heartRateBpm: number | null;
  cadenceRpm: number | null;
  powerWatts: number | null;
}

export interface ImportedActivity {
  name: string | null;
  /** Preserve the source sport; mapping to the app's sport catalog is separate. */
  sport: string | null;
  kind: 'activity' | 'route';
  startTime: string | null;
  endTime: string | null;
  elapsedTimeSeconds: number | null;
  /** FIT timer time excludes pauses; GPX does not reliably provide this. */
  timerTimeSeconds: number | null;
  distanceMeters: number | null;
  distanceSource: 'device' | 'coordinates' | null;
  caloriesKcal: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  samples: ActivitySample[];
}

export interface ActivityImport {
  source: { fileName: string; format: ActivityFileFormat; sizeBytes: number };
  /** One item per FIT session or GPX track/route. */
  activities: ImportedActivity[];
}

export type ActivityImportResult =
  | { status: 'cancelled' }
  | { status: 'imported'; data: ActivityImport };

export interface ActivityImportService {
  /** Call from a user action. The system picker grants access to the chosen file. */
  pickAndImport(): Promise<ActivityImportResult>;
}

export type ActivityImportErrorCode =
  | 'busy'
  | 'picker-failed'
  | 'read-failed'
  | 'unsupported-format'
  | 'file-too-large'
  | 'invalid-file'
  | 'no-activities';

export class ActivityImportError extends Error {
  constructor(
    readonly code: ActivityImportErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ActivityImportError';
  }
}
