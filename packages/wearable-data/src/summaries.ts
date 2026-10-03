import type { Payload, SourceEventV1 } from '@hackyeah/contracts/wearables';
import { WearableError } from './errors.js';

type SleepSegment = Extract<Payload, { kind: 'sleep_segment' }>;
/** Call only with one selected provider/account/application/device stream. Retains conflict evidence. */
export function summarizeSleepSegments(segments: readonly SleepSegment[]): {
  asleep_seconds: number | null;
  stage_conflict: boolean;
} {
  const streams = new Set(
    segments.map((segment) =>
      JSON.stringify([
        segment.provenance.source_application ?? null,
        segment.provenance.source_device ?? null,
      ]),
    ),
  );
  if (streams.size > 1) throw new WearableError('invalid_input');
  const asleep = segments.filter((segment) =>
    ['light', 'deep', 'rem', 'asleep_unspecified'].includes(segment.stage),
  );
  if (!asleep.length) return { asleep_seconds: null, stage_conflict: false };
  const intervals = asleep
    .map((segment) => [Date.parse(segment.start_at), Date.parse(segment.end_at)] as const)
    .sort((a, b) => a[0] - b[0]);
  let start = intervals[0]![0];
  let end = intervals[0]![1];
  let total = 0;
  for (const interval of intervals.slice(1)) {
    if (interval[0] > end) {
      total += end - start;
      start = interval[0];
    }
    end = Math.max(end, interval[1]);
  }
  const staged = segments.filter((s) => ['light', 'deep', 'rem', 'awake'].includes(s.stage));
  const conflict = staged.some((a, i) =>
    staged
      .slice(i + 1)
      .some((b) => a.stage !== b.stage && a.start_at < b.end_at && b.start_at < a.end_at),
  );
  return { asleep_seconds: (total + end - start) / 1000, stage_conflict: conflict };
}

/** Key comparable observations by method, window and source; never pool vendor HRV blindly. */
export function observationSeriesKey(providerSubject: string, event: SourceEventV1): string {
  const payload = event.payload;
  if (payload?.kind !== 'observation') throw new WearableError('invalid_input');
  const windowSeconds =
    payload.start_at && payload.end_at
      ? (Date.parse(payload.end_at) - Date.parse(payload.start_at)) / 1000
      : null;
  return JSON.stringify([
    event.provider,
    providerSubject,
    payload.metric,
    payload.unit,
    payload.method,
    payload.aggregation,
    windowSeconds,
    payload.provenance.source_application ?? null,
    payload.provenance.source_device ?? null,
  ]);
}
