import {
  workoutFileSummarySchema,
  type WorkoutFileSummary,
} from '@hackyeah/contracts/workout-file';
import { parseFit } from './fit.js';
import { parseGpx } from './gpx.js';
import { summarize } from './summary.js';
import { DEFAULT_CONFIG, ExtractionError, type Config, type Extraction } from './types.js';

export function configuration(overrides: Partial<Config> = {}): Config {
  const c = { ...DEFAULT_CONFIG, ...overrides };
  for (const [key, value] of Object.entries(c)) {
    if (
      !(key in DEFAULT_CONFIG) ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0
    )
      throw new ExtractionError(
        'invalid_config',
        'Configuration values must be finite and positive.',
      );
  }
  for (const key of ['maxFileBytes', 'maxSamples', 'maxXmlDepth', 'elevationWindow'] as const)
    if (!Number.isInteger(c[key]))
      throw new ExtractionError('invalid_config', 'Limits and window must be integers.');
  if (c.elevationWindow % 2 !== 1)
    throw new ExtractionError('invalid_config', 'Elevation window must be odd.');
  return c;
}

/** Internal worker entry point. Raw samples exist only while calculating summaries. */
export function extractSummary(bytes: Uint8Array, config: Config): WorkoutFileSummary {
  if (!bytes.byteLength) throw new ExtractionError('empty_file', 'Input file is empty.');
  if (bytes.byteLength > config.maxFileBytes)
    throw new ExtractionError('file_size_limit', 'Input exceeds configured size limit.');
  const format =
    bytes.byteLength >= 12 && String.fromCharCode(...bytes.subarray(8, 12)) === '.FIT'
      ? 'fit'
      : 'gpx';
  const result: Extraction = {
    schemaVersion: '1.0',
    source: { format, sizeBytes: bytes.byteLength },
    metadata: {},
    activities: [],
    routes: [],
    waypoints: [],
    warnings: [],
  };
  if (format === 'fit') parseFit(bytes, result, config);
  else parseGpx(bytes, result, config);
  for (const a of result.activities) summarize(a, config, result.warnings);
  if (!result.activities.length)
    result.warnings.push({
      code: 'no_activities',
      entity: 'file',
      message: 'No recorded tracks; routes and waypoints are excluded from workout totals.',
    });
  return workoutFileSummarySchema.parse({
    schemaVersion: result.schemaVersion,
    source: result.source,
    activities: result.activities.map((a) => ({
      id: a.id,
      name: a.name,
      sport: a.sport,
      startTime: a.startTime,
      endTime: a.endTime,
      sampleCount: a.segments.reduce((n, s) => n + s.samples.length, 0),
      segmentCount: a.segments.length,
      lapCount: a.laps.length,
      metrics: a.summary,
    })),
    routeCount: result.routes.length,
    waypointCount: result.waypoints.length,
    warnings: result.warnings,
  });
}
