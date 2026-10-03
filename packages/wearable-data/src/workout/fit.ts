import { Decoder, Stream } from '@garmin/fitsdk';
import {
  activity,
  jsonSafe,
  nonnegative,
  numeric,
  sample,
  seconds,
  time,
  warn,
} from './normalize.js';
import { ExtractionError, type Config, type Extraction, type Sample } from './types.js';

type Message = Record<string, unknown>;
function fitSample(record: Message, index: number, result: Extraction, entity: string): Sample {
  const degrees = (v: unknown) => {
    const n = numeric(v);
    return n === null ? null : (n * 180) / 2 ** 31;
  };
  const p = sample(
    index,
    {
      timestamp: record.timestamp,
      latitude: degrees(record.positionLat),
      longitude: degrees(record.positionLong),
      elevationM: record.enhancedAltitude ?? record.altitude,
      distanceM: record.distance,
      speedMps: record.enhancedSpeed ?? record.speed,
      heartRateBpm: record.heartRate,
      powerW: record.power,
      temperatureC: record.temperature,
      source: record,
    },
    result.warnings,
    `${entity}/sample:${index}`,
  );
  if (record.cadence !== undefined)
    p.cadence = { value: nonnegative(record.cadence), unit: 'rpm', context: 'fit.record.cadence' };
  return p;
}

export function parseFit(bytes: Uint8Array, result: Extraction, config: Config): void {
  const ordered: { num: number; message: Message; index: number }[] = [];
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  if (!decoder.isFIT()) throw new ExtractionError('invalid_fit', 'FIT header is invalid.');
  if (!decoder.checkIntegrity())
    throw new ExtractionError('fit_integrity', 'FIT integrity check failed.');
  const { messages, errors } = decoder.read({
    includeUnknownData: true,
    mergeHeartRates: false,
    decodeMemoGlobs: false,
    mesgListener: (num, message) => {
      if (ordered.length >= config.maxSamples)
        throw new ExtractionError('sample_limit', 'FIT message count exceeds configured limit.');
      ordered.push({ num, message: message as Message, index: ordered.length });
    },
  });
  if (errors.length) {
    if (errors[0] instanceof ExtractionError) throw errors[0];
    throw new ExtractionError('fit_decode', 'FIT decoding failed; partial data discarded.');
  }
  if (messages.fileIdMesgs?.length !== 1 || messages.fileIdMesgs[0]?.type !== 'activity')
    throw new ExtractionError('unsupported_fit', 'Only single FIT activity files are supported.');
  const sessions = ordered.filter((m) => m.num === 18);
  if (sessions.length > 100)
    throw new ExtractionError('session_limit', 'FIT has more than 100 sessions.');
  const records = ordered.filter((m) => m.num === 20),
    assigned = new Set<number>();
  const missingSessions = !sessions.length;
  if (missingSessions) {
    warn(
      result.warnings,
      'missing_session',
      'file',
      'No session summaries; records returned as an incomplete activity.',
    );
    sessions.push({ num: 18, message: {}, index: ordered.length });
  }
  for (const [j, s] of sessions.entries()) {
    const session = s.message;
    const sport = typeof session.sport === 'string' ? session.sport : null;
    const a = activity(`session:${j}`, null, sport);
    a.sourceSummary = jsonSafe(session) as Message;
    a.startTime = time(session.startTime, result.warnings, a.id);
    a.endTime = time(session.timestamp, result.warnings, a.id);
    if (a.endTime === null && a.startTime && nonnegative(session.totalElapsedTime) !== null)
      a.endTime = new Date(
        Date.parse(a.startTime) + nonnegative(session.totalElapsedTime)! * 1000,
      ).toISOString();
    const previousIndex = sessions[j - 1]?.index ?? -1;
    const belongs = (m: typeof s): boolean => {
      if (missingSessions) return true;
      const t = time(m.message.timestamp, [], a.id);
      const left = seconds(a.startTime, t),
        right = seconds(t, a.endTime);
      return left !== null && right !== null
        ? left >= 0 && right >= 0
        : m.index > previousIndex && m.index < s.index;
    };
    const ps = records.filter(belongs).map((m) => {
      assigned.add(m.index);
      return fitSample(m.message, m.index, result, a.id);
    });
    a.segments = [{ id: `${a.id}/segment:0`, samples: ps }];
    a.startTime ??= ps[0]?.timestamp ?? null;
    a.endTime ??= ps.at(-1)?.timestamp ?? null;
    for (const m of ordered.filter((m) => [19, 21].includes(m.num) && belongs(m))) {
      if (m.num === 19)
        a.laps.push({ sourceIndex: m.index, source: jsonSafe(m.message) as Message });
      else
        a.events.push({
          sourceIndex: m.index,
          timestamp: time(m.message.timestamp, result.warnings, a.id),
          event: String(m.message.event ?? ''),
          eventType: String(m.message.eventType ?? ''),
          source: jsonSafe(m.message) as Message,
        });
    }
    result.activities.push(a);
  }
  const unassigned = records.filter((m) => !assigned.has(m.index));
  if (unassigned.length) {
    const a = activity('unassigned');
    a.segments = [
      {
        id: 'unassigned/segment:0',
        samples: unassigned.map((m) => fitSample(m.message, m.index, result, a.id)),
      },
    ];
    result.activities.push(a);
    warn(
      result.warnings,
      'unassigned_records',
      a.id,
      'Records outside session ranges retained as a separate summary.',
    );
  }
}
