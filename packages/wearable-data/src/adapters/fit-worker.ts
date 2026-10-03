import { parentPort, workerData } from 'node:worker_threads';
import { Decoder, Stream } from '@garmin/fitsdk';
import { sourceEventSchema } from '@hackyeah/contracts/wearables';
import { fitImportSchema } from './fit.js';
import { digest } from '../hash.js';

try {
  const context = fitImportSchema.parse(workerData.context);
  const decoder = new Decoder(Stream.fromByteArray(workerData.bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new Error();
  let messageCount = 0;
  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    convertDateTimesToDates: true,
    convertTypesToStrings: true,
    includeUnknownData: false,
    mergeHeartRates: false,
    decodeMemoGlobs: false,
    mesgListener: () => {
      if (++messageCount > 250000) throw new Error();
    },
  });
  if (
    errors.length ||
    messages.fileIdMesgs?.length !== 1 ||
    messages.fileIdMesgs[0]?.type !== 'activity' ||
    !messages.sessionMesgs?.length ||
    messages.sessionMesgs.length > 100
  )
    throw new Error();
  const seen = new Set<string>();
  const events = messages.sessionMesgs.map((session, index) => {
    // Session order is stable within this immutable upload. A later cloud import has a separate namespace.
    const sessionId = String(session.messageIndex ?? index);
    if (seen.has(sessionId)) throw new Error();
    seen.add(sessionId);
    if (!(session.startTime instanceof Date)) throw new Error();
    const end =
      session.totalElapsedTime === undefined
        ? null
        : new Date(session.startTime.getTime() + session.totalElapsedTime * 1000).toISOString();
    const values = {
      elapsed_seconds: session.totalElapsedTime ?? null,
      timer_seconds: session.totalTimerTime ?? null,
      moving_seconds: session.totalMovingTime ?? null,
      distance_meters: session.totalDistance ?? null,
    };
    return sourceEventSchema.parse({
      schema_version: '1.0',
      connection_id: context.connection_id,
      connection_generation: context.connection_generation,
      provider: context.provider,
      dataset: 'workouts',
      external_id: `workout:fit:${context.import_id}:${sessionId}`,
      ingest_event_id: digest(['fit', context.import_id, sessionId]),
      operation: 'upsert',
      observed_at: context.observed_at,
      source_updated_at: null,
      revision: null,
      raw_object_ref: null,
      payload: {
        kind: 'workout',
        start_at: session.startTime.toISOString(),
        end_at: end,
        source_sport: String(session.sport ?? 'unknown'),
        normalized_sport: null,
        ...values,
        source_timezone: null,
        source_utc_offset_seconds: null,
        field_availability: Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            key,
            value === null ? 'unknown' : 'available',
          ]),
        ),
        provenance: {
          adapter_version: 'fit-21.217.0',
          transform_version: 'fit-summary-v1',
          import_mode: 'manual',
          source_identifiers: { import_id: context.import_id, session_id: sessionId },
          timezone_origin: 'unknown',
        },
      },
    });
  });
  parentPort?.postMessage(events);
} catch {
  // Do not send SDK errors (which can contain source fields) across the worker boundary.
  parentPort?.postMessage(null);
}
