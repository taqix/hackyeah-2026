import { Decoder, Stream, type RecordMesg, type SessionMesg } from '@garmin/fitsdk';

import { coordinate, finiteNumber, isoDate, nonNegative, summarize, textValue } from './normalize';
import { ActivityImportError, type ActivitySample, type ImportedActivity } from './types';

function position(value: unknown, limit: number): number | null {
  const semicircles = finiteNumber(value);
  return semicircles === null ? null : coordinate(semicircles * 180 / 2 ** 31, limit);
}

function sample(record: RecordMesg): ActivitySample {
  return {
    timestamp: isoDate(record.timestamp),
    segmentIndex: 0,
    latitude: position(record.positionLat, 90),
    longitude: position(record.positionLong, 180),
    altitudeMeters: finiteNumber(record.enhancedAltitude ?? record.altitude),
    distanceMeters: nonNegative(record.distance),
    speedMetersPerSecond: nonNegative(record.enhancedSpeed ?? record.speed),
    heartRateBpm: nonNegative(record.heartRate),
    cadenceRpm: nonNegative(record.cadence),
    powerWatts: nonNegative(record.power),
  };
}

function activity(session: SessionMesg, samples: ActivitySample[]): ImportedActivity {
  const derived = summarize(samples);
  const startTime = isoDate(session.startTime) ?? derived.startTime;
  const endTime = isoDate(session.timestamp) ?? derived.endTime;
  const elapsed = startTime && endTime ? (Date.parse(endTime) - Date.parse(startTime)) / 1000 : null;
  const distance = nonNegative(session.totalDistance);
  return {
    ...derived,
    sport: textValue(session.sport),
    startTime,
    endTime,
    elapsedTimeSeconds: nonNegative(session.totalElapsedTime) ?? nonNegative(elapsed),
    timerTimeSeconds: nonNegative(session.totalTimerTime),
    distanceMeters: distance ?? derived.distanceMeters,
    distanceSource: distance === null ? derived.distanceSource : 'device',
    caloriesKcal: nonNegative(session.totalCalories),
    averageHeartRateBpm: nonNegative(session.avgHeartRate),
    maxHeartRateBpm: nonNegative(session.maxHeartRate),
  };
}

export function parseFit(bytes: Uint8Array, maxSamples: number): ImportedActivity[] {
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) {
    throw new ActivityImportError('invalid-file', 'The FIT header, length or checksum is invalid.');
  }
  let count = 0;
  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    convertDateTimesToDates: true,
    convertTypesToStrings: true,
    mesgListener: (messageNumber) => {
      if (messageNumber === 20 && ++count > maxSamples) {
        throw new ActivityImportError('file-too-large', 'The activity contains too many samples.');
      }
    },
  });
  if (errors.length) {
    const limitError = errors.find((error) => error instanceof ActivityImportError);
    if (limitError) throw limitError;
    throw new ActivityImportError('invalid-file', 'The FIT data could not be decoded.', { cause: errors[0] });
  }
  if (messages.fileIdMesgs?.[0]?.type !== 'activity') {
    throw new ActivityImportError('no-activities', 'Select a FIT activity, not a course or workout definition.');
  }
  const samples = (messages.recordMesgs ?? []).map(sample);
  const sessions = messages.sessionMesgs ?? [];
  if (sessions.length === 0) return samples.length ? [summarize(samples)] : [];
  if (sessions.length === 1) return [activity(sessions[0], samples)];

  // Multisport files contain several sessions. Assign each sample exactly once.
  const ranges = sessions.map((session) => ({
    session,
    start: isoDate(session.startTime),
    end: isoDate(session.timestamp),
    samples: [] as ActivitySample[],
  }));
  if (ranges.some((range) => !range.start || !range.end || range.start > range.end)) {
    throw new ActivityImportError('invalid-file', 'The FIT sessions have invalid time boundaries.');
  }
  ranges.sort((a, b) => a.start!.localeCompare(b.start!));
  for (const point of samples) {
    // On an exact shared boundary the sample belongs to the session starting there.
    const range = ranges.findLast((candidate) => point.timestamp !== null &&
      point.timestamp >= candidate.start! && point.timestamp <= candidate.end!);
    if (!range) {
      throw new ActivityImportError('invalid-file', 'A FIT sample cannot be assigned to a session.');
    }
    range.samples.push(point);
  }
  return ranges.map((range) => activity(range.session, range.samples));
}
