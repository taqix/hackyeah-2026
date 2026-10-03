import { describe, expect, it } from 'vitest';
import {
  Encoder,
  Profile,
  type RecordMesg,
  type SessionMesg,
  type EventMesg,
  type FileIdMesg,
} from '@garmin/fitsdk';
import { extractWorkoutSummary } from '../dist/index.js';
import { workoutFileSummarySchema } from '@hackyeah/contracts/workout-file';

const encode = (text: string) => new TextEncoder().encode(text);
const time = (sec: number) => new Date(Date.UTC(2026, 9, 3, 12, 0, sec));
type Point = [number, number, number | null, number | null];
function gpx(segments: Point[][], extra = '') {
  return encode(`<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="synthetic">
  <trk><name>Run</name><type>running</type>${segments
    .map(
      (points) =>
        `<trkseg>${points
          .map(
            ([lat, lon, ele, sec]) =>
              `<trkpt lat="${lat}" lon="${lon}">${ele === null ? '' : `<ele>${ele}</ele>`}${sec === null ? '' : `<time>${time(sec).toISOString()}</time>`}</trkpt>`,
          )
          .join('')}</trkseg>`,
    )
    .join('')}</trk>${extra}</gpx>`);
}
function fit(
  records: RecordMesg[],
  sessions: SessionMesg[] = [],
  events: EventMesg[] = [],
  kind: 'activity' | 'workout' = 'activity',
) {
  const encoder = new Encoder();
  const file: FileIdMesg = { type: kind, manufacturer: 'development', product: 1 };
  encoder.onMesg(Profile.MesgNum.FILE_ID!, file);
  for (const r of records) encoder.onMesg(Profile.MesgNum.RECORD!, r);
  for (const e of events) encoder.onMesg(Profile.MesgNum.EVENT!, e);
  for (const s of sessions) encoder.onMesg(Profile.MesgNum.SESSION!, s);
  return encoder.close();
}
async function summary(bytes: Uint8Array) {
  return (await extractWorkoutSummary(bytes)).activities[0]!.metrics;
}

describe('storage-independent workout file summaries', () => {
  it('summarizes a known GPX climb and stationary interval without exposing raw location', async () => {
    const bytes = gpx([
      [
        [52, 21, 100, 0],
        [52, 21.001, 105, 10],
        [52, 21.002, 110, 20],
        [52, 21.002, 110, 30],
      ],
    ]);
    const before = bytes.slice();
    const result = await extractWorkoutSummary(bytes);
    const s = result.activities[0]!.metrics;
    expect(s.elapsedTime?.value).toBe(30);
    expect(s.movingTime).toMatchObject({ value: 20, complete: true, origin: 'derived' });
    expect(s.elevationGain?.value).toBe(10);
    expect(s.distance?.value).toBeGreaterThan(130);
    expect(s.distance?.value).toBeLessThan(140);
    expect(s.averagePace?.value).toBeGreaterThan(0);
    expect(bytes).toEqual(before);
    expect(JSON.stringify(result)).not.toMatch(/latitude|longitude|serialNumber|<trkpt/);
    expect(workoutFileSummarySchema.parse(result)).toEqual(result);
    expect(await extractWorkoutSummary(bytes)).toEqual(result);
  });
  it('does not connect segments or count long gaps as motion or climbing', async () => {
    const s = await summary(
      gpx([
        [
          [52, 21, 10, 0],
          [52, 21.001, 15, 10],
          [52, 21.005, 50, 50],
        ],
        [
          [53, 22, 200, 51],
          [53, 22.001, 205, 59],
        ],
      ]),
    );
    expect(s.movingTime).toMatchObject({
      value: 18,
      complete: false,
      coverage: { excludedSeconds: 40 },
    });
    expect(s.elevationGain?.value).toBe(10);
    expect(s.elevationGain?.complete).toBe(false);
    expect(s.distance?.value).toBeLessThan(150);
  });
  it('ignores small GPS/elevation noise but counts slow walking', async () => {
    const flat = await summary(
      gpx([
        [
          [52, 21, 100, 0],
          [52, 21.000001, 101, 10],
          [52, 21, 100, 20],
        ],
      ]),
    );
    expect(flat.movingTime?.value).toBe(0);
    expect(flat.elevationGain?.value).toBe(0);
    const slow = await summary(
      gpx([
        [
          [52, 21, 100, 0],
          [52, 21.00006, 105, 10],
        ],
      ]),
    );
    expect(slow.movingTime?.value).toBe(10);
  });
  it('preserves null for missing movement/elevation and rejects duplicate or reversed timing', async () => {
    const s = await summary(
      gpx([
        [
          [52, 21, null, 10],
          [52, 21.001, null, 10],
          [52, 21.002, null, 5],
          [52, 21.003, null, null],
        ],
      ]),
    );
    expect(s.movingTime?.value).toBeNull();
    expect(s.elevationGain?.value).toBeNull();
    expect(s.elapsedTime?.value).toBeNull();
  });
  it('can estimate untimed geometry without claiming moving time or full coverage', async () => {
    const s = await summary(
      gpx([
        [
          [52, 21, 1, null],
          [52, 21.001, 6, null],
        ],
      ]),
    );
    expect(s.distance?.value).toBeGreaterThan(60);
    expect(s.distance?.complete).toBe(false);
    expect(s.movingTime?.value).toBeNull();
    expect(s.elapsedTime?.value).toBeNull();
    expect(s.elevationGain?.value).toBe(5);
  });
  it('counts routes/waypoints separately and handles prefixed GPX namespaces', async () => {
    const result = await extractWorkoutSummary(
      encode(`<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1" version="1.1">
      <g:rte><g:rtept lat="52" lon="21"/></g:rte><g:wpt lat="53" lon="22"/></g:gpx>`),
    );
    expect(result.activities).toEqual([]);
    expect(result.routeCount).toBe(1);
    expect(result.waypointCount).toBe(1);
    expect(result.warnings.some((w) => w.code === 'no_activities')).toBe(true);
  });
  it('normalizes offsets and preserves ambiguous local timestamps without inventing moving time', async () => {
    const bytes = gpx([
      [
        [52, 21, 1, 0],
        [52, 21.001, 6, 10],
      ],
    ]);
    const text = new TextDecoder()
      .decode(bytes)
      .replaceAll('12:00:', '14:00:')
      .replaceAll('Z</time>', '+02:00</time>');
    const offset = await extractWorkoutSummary(encode(text));
    expect(offset.activities[0]?.startTime).toBe('2026-10-03T12:00:00.000Z');
    const local = await extractWorkoutSummary(encode(text.replaceAll('+02:00', '')));
    expect(local.activities[0]?.metrics.movingTime?.value).toBeNull();
    expect(local.warnings.some((w) => w.code === 'timezone_missing')).toBe(true);
  });
  it('excludes impossible coordinates and speed spikes', async () => {
    const result = await extractWorkoutSummary(
      gpx([
        [
          [100, 21, 1, 0],
          [52, 21, 6, 10],
        ],
      ]),
    );
    expect(result.activities[0]?.metrics.distance?.value).toBeNull();
    expect(result.warnings.some((w) => w.code === 'invalid_coordinates')).toBe(true);
    const spike = await summary(
      gpx([
        [
          [52, 21, 100, 0],
          [53, 22, 100, 1],
        ],
      ]),
    );
    expect(spike.movingTime?.value).toBeNull();
    expect(spike.distance?.value).toBeNull();
  });
  it.each([
    ['', 'empty_file'],
    ['<gpx>', 'invalid_xml'],
    ['<!DOCTYPE gpx [<!ENTITY x "boom">]><gpx>&x;</gpx>', 'invalid_xml'],
    ['<gpx version="1.0"/>', 'unsupported_gpx'],
    [
      '<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">&undefined;</gpx>',
      'invalid_xml',
    ],
  ])('rejects unsupported or malformed XML %s', async (text, code) => {
    await expect(extractWorkoutSummary(encode(text))).rejects.toMatchObject({ code });
  });
  it('enforces size, count, depth and config limits', async () => {
    const bytes = gpx([
      [
        [52, 21, 1, 0],
        [52, 21, 2, 1],
      ],
    ]);
    await expect(extractWorkoutSummary(bytes, { maxFileBytes: 10 })).rejects.toMatchObject({
      code: 'file_size_limit',
    });
    await expect(extractWorkoutSummary(bytes, { maxSamples: 1 })).rejects.toMatchObject({
      code: 'sample_limit',
    });
    await expect(extractWorkoutSummary(bytes, { maxXmlDepth: 2 })).rejects.toMatchObject({
      code: 'xml_depth_limit',
    });
    await expect(extractWorkoutSummary(bytes, { maxGapSeconds: NaN })).rejects.toMatchObject({
      code: 'invalid_config',
    });
    await expect(extractWorkoutSummary(bytes, { elevationWindow: 2 })).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });
  it('uses FIT source totals and splits moving intervals at explicit pause events', async () => {
    const bytes = fit(
      [
        {
          timestamp: time(0),
          positionLat: Math.round((52 * 2 ** 31) / 180),
          positionLong: Math.round((21 * 2 ** 31) / 180),
          enhancedAltitude: 100,
          enhancedSpeed: 2,
          heartRate: 140,
        },
        { timestamp: time(10), enhancedAltitude: 110, enhancedSpeed: 2 },
        { timestamp: time(20), enhancedAltitude: 120, enhancedSpeed: 2 },
      ],
      [
        {
          startTime: time(0),
          timestamp: time(20),
          sport: 'running',
          totalElapsedTime: 20,
          totalTimerTime: 15,
          totalDistance: 40,
          totalAscent: 25,
          avgHeartRate: 145,
        },
      ],
      [
        { timestamp: time(5), event: 'timer', eventType: 'stop' },
        { timestamp: time(10), event: 'timer', eventType: 'start' },
      ],
    );
    const s = await summary(bytes);
    expect(s.movingTime).toMatchObject({ value: 15, origin: 'derived' });
    expect(s.timerTime?.value).toBe(15);
    expect(s.elevationGain).toMatchObject({ value: 25, origin: 'source' });
    expect(s.derivedElevationGain?.value).toBe(20);
    expect(s.averageHeartRate?.value).toBe(145);
    expect(s.distance?.value).toBe(40);
    expect(s.averageSpeed?.value).toBeCloseTo(40 / 15);
  });
  it('does not substitute timer time for moving time in indoor workouts', async () => {
    const s = await summary(
      fit(
        [
          { timestamp: time(0), heartRate: 100 },
          { timestamp: time(20), heartRate: 120 },
        ],
        [{ startTime: time(0), timestamp: time(20), sport: 'training', totalTimerTime: 20 }],
      ),
    );
    expect(s.timerTime?.value).toBe(20);
    expect(s.movingTime?.value).toBeNull();
    expect(s.distance?.value).toBeNull();
  });
  it('supports indoor speed and preserves a source moving-time total', async () => {
    const s = await summary(
      fit(
        [
          { timestamp: time(0), speed: 2 },
          { timestamp: time(20), speed: 2 },
        ],
        [{ startTime: time(0), timestamp: time(20), totalMovingTime: 18 }],
      ),
    );
    expect(s.movingTime).toMatchObject({ value: 18, origin: 'source' });
    expect(s.derivedMovingTime?.value).toBe(20);
  });
  it('rejects FIT checksum corruption, truncation, unsupported types and excessive message counts', async () => {
    const bytes = fit([{ timestamp: time(0), speed: 2 }]);
    const corrupt = bytes.slice();
    corrupt[corrupt.length - 1] = corrupt.at(-1)! ^ 0xff;
    await expect(extractWorkoutSummary(corrupt)).rejects.toMatchObject({ code: 'fit_integrity' });
    await expect(extractWorkoutSummary(bytes.slice(0, -2))).rejects.toMatchObject({
      code: 'fit_integrity',
    });
    await expect(extractWorkoutSummary(fit([], [], [], 'workout'))).rejects.toMatchObject({
      code: 'unsupported_fit',
    });
    await expect(extractWorkoutSummary(bytes, { maxSamples: 1 })).rejects.toMatchObject({
      code: 'sample_limit',
    });
  });
  it('keeps FIT sessions separate and reports missing summaries', async () => {
    const records = [0, 10, 30, 40].map((t) => ({ timestamp: time(t), speed: 2 }));
    const result = await extractWorkoutSummary(
      fit(records, [
        { startTime: time(0), timestamp: time(10), sport: 'running' },
        { startTime: time(30), timestamp: time(40), sport: 'cycling' },
      ]),
    );
    expect(result.activities.map((a) => a.metrics.movingTime?.value)).toEqual([10, 10]);
    expect(result.activities.map((a) => a.sampleCount)).toEqual([2, 2]);
    const missing = await extractWorkoutSummary(fit(records.slice(0, 2)));
    expect(missing.activities[0]?.metrics.movingTime?.value).toBe(10);
    expect(missing.warnings.some((w) => w.code === 'missing_session')).toBe(true);
  });
  it('shares a FIT boundary sample with adjacent sessions', async () => {
    const result = await extractWorkoutSummary(
      fit(
        [0, 10, 20].map((t) => ({ timestamp: time(t), speed: 2, distance: t * 2 })),
        [
          { startTime: time(0), timestamp: time(10), sport: 'running' },
          { startTime: time(10), timestamp: time(20), sport: 'cycling' },
        ],
      ),
    );
    expect(result.activities.map((a) => a.metrics.movingTime?.value)).toEqual([10, 10]);
    expect(result.activities.map((a) => a.sampleCount)).toEqual([2, 2]);
  });
  it('applies timer events that precede records when FIT session summaries are absent', async () => {
    const s = await summary(
      fit(
        [10, 20].map((t) => ({ timestamp: time(t), speed: 2 })),
        [],
        [{ timestamp: time(0), event: 'timer', eventType: 'stop' }],
      ),
    );
    expect(s.movingTime?.value).toBe(0);
  });
});

it('labels unobserved FIT duration as incomplete and never fills it with movement', async () => {
  const s = await summary(
    fit(
      [
        { timestamp: time(10), speed: 2 },
        { timestamp: time(20), speed: 2 },
      ],
      [{ startTime: time(0), timestamp: time(30), totalElapsedTime: 30 }],
    ),
  );
  expect(s.movingTime).toMatchObject({
    value: 10,
    complete: false,
    coverage: { unobservedSeconds: 20 },
  });
});

it('ignores an isolated elevation spike and exposes incomplete coverage', async () => {
  const s = await summary(
    gpx([
      [
        [52, 21, 100, 0],
        [52, 21.00001, 1000, 10],
        [52, 21.00002, 100, 20],
        [52, 21.00003, 100, 30],
      ],
    ]),
  );
  expect(s.elevationGain).toMatchObject({ value: 0, complete: false });
});

it('rejects invalid calendar timestamps instead of normalizing them to another date', async () => {
  const text = new TextDecoder()
    .decode(
      gpx([
        [
          [52, 21, 1, 0],
          [52, 21.001, 5, 10],
        ],
      ]),
    )
    .replaceAll('2026-10-03', '2026-02-30');
  const result = await extractWorkoutSummary(encode(text));
  expect(result.activities[0]?.metrics.movingTime?.value).toBeNull();
  expect(result.warnings.some((w) => w.code === 'invalid_timestamp')).toBe(true);
});

it('reports unknown GPX extensions without leaking their content', async () => {
  const text =
    '<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1"><trk><trkseg><trkpt lat="52" lon="21"><extensions><secret xmlns="urn:device">private-device-id</secret></extensions></trkpt></trkseg></trk></gpx>';
  const result = await extractWorkoutSummary(encode(text));
  expect(result.warnings.some((w) => w.code === 'unsupported_extension')).toBe(true);
  expect(JSON.stringify(result)).not.toContain('private-device-id');
});
