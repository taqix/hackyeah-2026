import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { Encoder, Profile, type FileIdMesg, type RecordMesg, type SessionMesg } from '@garmin/fitsdk';

import { parseFit } from '../../src/services/activity-import/fit';
import { parseGpx } from '../../src/services/activity-import/gpx';
import { MAX_ACTIVITY_FILE_BYTES, parseActivityFile } from '../../src/services/activity-import/parser';

const runGpx = readFileSync(new URL('./fixtures/run.gpx', import.meta.url));
const start = new Date('2026-10-03T10:00:00Z');
const end = new Date('2026-10-03T10:01:00Z');

function gpx(xml: string) {
  return parseActivityFile({ fileName: 'test.gpx', bytes: new TextEncoder().encode(xml) });
}

function fit(records: RecordMesg[], sessions: SessionMesg[] = [], type: FileIdMesg['type'] = 'activity') {
  const encoder = new Encoder();
  const fileId: FileIdMesg = { type, manufacturer: 'development', timeCreated: start };
  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  for (const record of records) encoder.onMesg(Profile.MesgNum.RECORD, record);
  for (const session of sessions) encoder.onMesg(Profile.MesgNum.SESSION, session);
  return encoder.close();
}

test('GPX normalizes timestamps, sensor extensions, zero coordinates, and segment distance', () => {
  const data = parseActivityFile({ fileName: 'RUN.GPX', bytes: runGpx });
  assert.equal(data.source.format, 'gpx');
  assert.equal(data.source.sizeBytes, runGpx.byteLength);
  assert.equal(data.activities.length, 1);
  const activity = data.activities[0];
  assert.equal(activity.name, 'Bieg & spacer');
  assert.equal(activity.sport, 'running');
  assert.equal(activity.startTime, start.toISOString());
  assert.equal(activity.elapsedTimeSeconds, 180);
  assert.equal(activity.timerTimeSeconds, null);
  assert.equal(activity.averageHeartRateBpm, null);
  assert.equal(activity.distanceSource, 'coordinates');
  // About 221 m within the two segments; the 1500 km gap must not count.
  assert.ok(activity.distanceMeters !== null && Math.abs(activity.distanceMeters - 220.7) < 0.2);
  assert.deepEqual(activity.samples[0], {
    timestamp: start.toISOString(), segmentIndex: 0, latitude: 0, longitude: 0,
    altitudeMeters: -2, distanceMeters: null, speedMetersPerSecond: null,
    heartRateBpm: 120, cadenceRpm: 80, powerWatts: 200,
  });
  assert.equal(activity.samples[1].altitudeMeters, 0);
  assert.equal(activity.samples[1].heartRateBpm, null);
  assert.equal(activity.samples[2].segmentIndex, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
});

test('GPX retains multiple tracks and distinguishes routes without inventing dates', () => {
  const { activities } = gpx(`<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1">
    <g:trk><g:name>First</g:name><g:trkseg><g:trkpt lat="1" lon="2"/></g:trkseg></g:trk>
    <g:trk><g:name>Second</g:name><g:trkseg><g:trkpt lat="3" lon="4"/></g:trkseg></g:trk>
    <g:rte><g:name>Planned</g:name><g:rtept lat="5" lon="6"/></g:rte>
  </g:gpx>`);
  assert.deepEqual(activities.map((item) => item.name), ['First', 'Second', 'Planned']);
  assert.equal(activities[2].kind, 'route');
  for (const activity of activities) {
    assert.equal(activity.startTime, null);
    assert.equal(activity.elapsedTimeSeconds, null);
    assert.equal(activity.distanceMeters, null);
  }
});

test('GPX 1.0 metadata and optional measurements work without sensor values', () => {
  const activity = gpx(`<gpx version="1.0"><name>Old export</name><trk><trkseg>
    <trkpt lat="-45" lon="-100"><ele>NaN</ele><speed>0</speed></trkpt>
  </trkseg></trk></gpx>`).activities[0];
  assert.equal(activity.name, 'Old export');
  assert.equal(activity.samples[0].speedMetersPerSecond, 0);
  assert.equal(activity.samples[0].altitudeMeters, null);
});

for (const xml of [
  '<gpx><trk></gpx>',
  '<html/>',
  '<!DOCTYPE gpx [<!ENTITY x "boom">]><gpx>&x;</gpx>',
  '<gpx><trk><trkseg><trkpt lat="91" lon="0"/></trkseg></trk></gpx>',
  '<gpx><trk><trkseg><trkpt lat="" lon="0"/></trkseg></trk></gpx>',
  '<gpx><trk><trkseg><trkpt lat="0" lon="0"><time>2026-10-03T10:00:00</time></trkpt></trkseg></trk></gpx>',
  '<?xml version="1.0" encoding="UTF-16"?><gpx/>',
]) {
  test(`reject invalid GPX: ${xml.slice(0, 65)}`, () => {
    assert.throws(() => gpx(xml), { code: 'invalid-file' });
  });
}

test('empty, waypoint-only, wrong-extension, oversized and corrupt UTF-8 inputs fail explicitly', () => {
  assert.throws(() => gpx(''), { code: 'invalid-file' });
  assert.throws(() => gpx('<gpx><wpt lat="1" lon="2"/></gpx>'), { code: 'no-activities' });
  assert.throws(() => parseActivityFile({ fileName: 'a.zip', bytes: runGpx }), { code: 'unsupported-format' });
  assert.throws(() => parseActivityFile({ fileName: 'gpx', bytes: runGpx }), { code: 'unsupported-format' });
  assert.throws(() => parseActivityFile({ fileName: 'a.gpx', bytes: new Uint8Array(MAX_ACTIVITY_FILE_BYTES + 1) }), { code: 'file-too-large' });
  assert.throws(() => parseActivityFile({ fileName: 'a.gpx', bytes: new Uint8Array([0xff]) }), { code: 'invalid-file' });
  assert.throws(() => parseGpx(runGpx.toString(), 2), { code: 'file-too-large' });
});

test('real FIT binary decoding applies scales, epochs and semicircle coordinates', () => {
  const bytes = fit([
    { timestamp: start, positionLat: 2 ** 29, positionLong: -(2 ** 30), altitude: 100, speed: 3, distance: 0, heartRate: 120, power: 200, cadence: 80 },
    { timestamp: end, enhancedAltitude: 123.4, enhancedSpeed: 4.5, distance: 250, heartRate: 140 },
  ], [{ startTime: start, timestamp: end, sport: 'running', totalElapsedTime: 60, totalTimerTime: 50, totalDistance: 250, totalCalories: 25, avgHeartRate: 130, maxHeartRate: 140 }]);
  // Non-zero byte offset: importing a view must not decode its surrounding bytes.
  const padded = new Uint8Array(bytes.length + 10);
  padded.set(bytes, 5);
  const data = parseActivityFile({ fileName: 'run.FIT', bytes: padded.subarray(5, -5) });
  const activity = data.activities[0];
  assert.equal(activity.sport, 'running');
  assert.equal(activity.startTime, start.toISOString());
  assert.equal(activity.elapsedTimeSeconds, 60);
  assert.equal(activity.timerTimeSeconds, 50);
  assert.equal(activity.distanceMeters, 250);
  assert.equal(activity.distanceSource, 'device');
  assert.equal(activity.caloriesKcal, 25);
  assert.equal(activity.averageHeartRateBpm, 130);
  assert.equal(activity.maxHeartRateBpm, 140);
  assert.equal(activity.samples[0].latitude, 45);
  assert.equal(activity.samples[0].longitude, -90);
  assert.equal(activity.samples[0].altitudeMeters, 100);
  assert.equal(activity.samples[0].speedMetersPerSecond, 3);
  assert.equal(activity.samples[0].powerWatts, 200);
  assert.equal(activity.samples[1].latitude, null);
  assert.ok(Math.abs(activity.samples[1].altitudeMeters! - 123.4) < 1e-9);
  assert.equal(activity.samples[1].speedMetersPerSecond, 4.5);
  assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
  assert.throws(() => parseFit(bytes, 1), { code: 'file-too-large' });
});

test('FIT indoor sessions import without GPS or records and preserve actual zeroes', () => {
  const { activities } = parseActivityFile({ fileName: 'indoor.fit', bytes: fit([], [{
    sport: 'training', startTime: start, timestamp: end, totalDistance: 0, totalCalories: 0,
  }]) });
  assert.equal(activities[0].distanceMeters, 0);
  assert.equal(activities[0].caloriesKcal, 0);
  assert.equal(activities[0].elapsedTimeSeconds, 60);
  assert.deepEqual(activities[0].samples, []);
});

test('FIT multisport assigns boundary samples once and retains session summaries', () => {
  const finish = new Date('2026-10-03T10:02:00Z');
  const bytes = fit([{ timestamp: start }, { timestamp: end }, { timestamp: finish }], [
    { startTime: start, timestamp: end, sport: 'running', totalDistance: 100 },
    { startTime: end, timestamp: finish, sport: 'cycling', totalDistance: 300 },
  ]);
  const { activities } = parseActivityFile({ fileName: 'multisport.fit', bytes });
  assert.deepEqual(activities.map((item) => item.samples.length), [1, 2]);
  assert.deepEqual(activities.map((item) => item.distanceMeters), [100, 300]);
});

test('FIT records without a session still import, and missing values remain null', () => {
  const activity = parseActivityFile({ fileName: 'partial.fit', bytes: fit([{ timestamp: start, heartRate: 120 }]) }).activities[0];
  assert.equal(activity.samples[0].heartRateBpm, 120);
  assert.equal(activity.samples[0].latitude, null);
  assert.equal(activity.samples[0].distanceMeters, null);
  assert.equal(activity.distanceMeters, null);
});

test('FIT checksum failure, truncation, and non-activity files are rejected', () => {
  const bytes = fit([{ timestamp: start }]);
  const corrupt = bytes.slice();
  corrupt[corrupt.length - 1] ^= 0xff;
  for (const bad of [corrupt, bytes.subarray(0, -1), new Uint8Array([1, 2, 3])]) {
    assert.throws(() => parseActivityFile({ fileName: 'bad.fit', bytes: bad }), { code: 'invalid-file' });
  }
  assert.throws(() => parseActivityFile({ fileName: 'course.fit', bytes: fit([], [], 'course') }), { code: 'no-activities' });
  assert.throws(() => parseActivityFile({ fileName: 'empty.fit', bytes: fit([]) }), { code: 'no-activities' });
});

test('FIT multisport rejects missing boundaries or unassignable samples instead of losing data', () => {
  for (const sessions of [
    [{ startTime: start, timestamp: end }, { timestamp: end }],
    [{ startTime: end, timestamp: end }, { startTime: end, timestamp: end }],
  ]) {
    const bytes = fit([{ timestamp: start }], sessions);
    assert.throws(() => parseActivityFile({ fileName: 'broken.fit', bytes }), { code: 'invalid-file' });
  }
});
