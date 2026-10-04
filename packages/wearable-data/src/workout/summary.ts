import { epoch, geodesic, nonnegative, seconds, warn } from './normalize.js';
import type { Activity, Config, Metric, Sample, Warning } from './types.js';

function metric(
  value: number | null,
  unit: string,
  origin: Metric['origin'],
  method: string,
  complete = true,
  coverage?: Metric['coverage'],
  parameters?: Metric['parameters'],
): Metric {
  return {
    value,
    unit,
    origin,
    method,
    complete: value !== null && complete,
    coverage,
    parameters,
  };
}
function source(a: Activity, field: string, unit: string): Metric {
  return metric(nonnegative(a.sourceSummary[field]), unit, 'source', `fit.session.${field}`);
}
function elevation(a: Activity, c: Config): Metric {
  let total = 0,
    pairs = 0;
  const possible = a.segments.reduce((n, s) => n + Math.max(0, s.samples.length - 1), 0);
  const radius = Math.floor(c.elevationWindow / 2);
  function gain(run: number[]): number {
    if (run.length < 2) return 0;
    const smooth = run.map((v, i) => {
      if (i < radius || i >= run.length - radius) return v; // Preserve endpoints.
      const window = run.slice(i - radius, i + radius + 1).sort((x, y) => x - y);
      return window[Math.floor(window.length / 2)]!;
    });
    let anchor = smooth[0]!,
      peak = anchor,
      climbing = false,
      sum = 0;
    for (const v of smooth.slice(1)) {
      if (!climbing) {
        anchor = Math.min(anchor, v);
        if (v - anchor >= c.elevationThresholdM) {
          climbing = true;
          peak = v;
        }
      } else {
        peak = Math.max(peak, v);
        if (peak - v >= c.elevationThresholdM) {
          sum += peak - anchor;
          anchor = v;
          climbing = false;
        }
      }
    }
    return sum + (climbing ? peak - anchor : 0);
  }
  for (const segment of a.segments) {
    let run: number[] = [],
      previous: Sample | null = null;
    for (const p of segment.samples) {
      const dt = previous ? seconds(previous.timestamp, p.timestamp) : null;
      const discontinuity = previous !== null && dt !== null && (dt <= 0 || dt > c.maxGapSeconds);
      const spike =
        previous !== null &&
        dt !== null &&
        dt > 0 &&
        !discontinuity &&
        p.elevationM !== null &&
        previous.elevationM !== null &&
        Math.abs(p.elevationM - previous.elevationM) / dt > c.maxVerticalSpeedMps;
      if (p.elevationM === null || discontinuity || spike) {
        total += gain(run);
        run = [];
        previous = null;
      }
      if (spike) continue;
      if (p.elevationM !== null) {
        if (run.length) pairs++;
        run.push(p.elevationM);
        previous = p;
      }
    }
    total += gain(run);
  }
  return metric(
    pairs ? total : null,
    'm',
    'derived',
    'median-hysteresis-v1',
    pairs === possible && possible > 0,
    { evaluatedIntervals: pairs, totalIntervals: possible },
    {
      window: c.elevationWindow,
      thresholdM: c.elevationThresholdM,
      maxGapSeconds: c.maxGapSeconds,
      maxVerticalSpeedMps: c.maxVerticalSpeedMps,
    },
  );
}

export function summarize(a: Activity, c: Config, warnings: Warning[]): void {
  const possible = a.segments.reduce((n, s) => n + Math.max(0, s.samples.length - 1), 0);
  const threshold = a.sport === 'cycling' ? c.cyclingThresholdMps : c.movementThresholdMps;
  const events = a.events
    .filter((e) => e.event === 'timer' && epoch(e.timestamp) !== null)
    .map((e) => ({ at: epoch(e.timestamp)!, type: e.eventType }))
    .sort((x, y) => x.at - y.at);
  const running = (at: number): boolean => {
    let active = true;
    for (const e of events) {
      if (e.at > at) break;
      if (e.type === 'start') active = true;
      else if (['stop', 'stopAll', 'stopDisable', 'stopDisableAll'].includes(e.type))
        active = false;
    }
    return active;
  };
  let moving = 0,
    evaluated = 0,
    excluded = 0,
    invalid = 0,
    movingPairs = 0,
    distancePairs = 0,
    distance = 0;
  for (const segment of a.segments) {
    for (let i = 1; i < segment.samples.length; i++) {
      const left = segment.samples[i - 1]!,
        right = segment.samples[i]!;
      const dt = seconds(left.timestamp, right.timestamp);
      let d = geodesic(left, right);
      if (left.distanceM !== null && right.distanceM !== null)
        d = right.distanceM >= left.distanceM ? right.distanceM - left.distanceM : null;
      if (dt === null) {
        // Untimed GPX still provides route length, but cannot support speed/gap validation.
        if (d !== null) {
          distance += d;
          distancePairs++;
        }
        invalid++;
        continue;
      }
      if (dt <= 0) {
        invalid++;
        continue;
      }
      if (dt > c.maxGapSeconds) {
        excluded += dt;
        continue;
      }
      if (d !== null && d / dt <= c.maxSpeedMps) {
        distance += d;
        distancePairs++;
      }
      const speed = left.speedMps ?? (d !== null ? d / dt : null);
      if (speed === null || speed > c.maxSpeedMps || (d !== null && d / dt > c.maxSpeedMps)) {
        excluded += dt;
        continue;
      }
      movingPairs++;
      evaluated += dt;
      const start = epoch(left.timestamp)!,
        end = epoch(right.timestamp)!;
      const cuts = [
        start,
        ...events.filter((e) => e.at > start && e.at < end).map((e) => e.at),
        end,
      ];
      for (let j = 1; j < cuts.length; j++)
        if (speed > threshold && running(cuts[j - 1]!)) moving += cuts[j]! - cuts[j - 1]!;
    }
  }
  const span = seconds(a.startTime, a.endTime);
  const allSamples = a.segments.flatMap((s) => s.samples);
  const timed = allSamples.every((p) => epoch(p.timestamp) !== null);
  let elapsed = source(a, 'totalElapsedTime', 's');
  if (elapsed.value === null)
    elapsed = metric(
      span !== null && span >= 0 ? span : null,
      's',
      'derived',
      'session-span-v1',
      timed && invalid === 0,
    );
  const elapsedSpan = elapsed.value ?? span;
  const unobserved = elapsedSpan !== null ? Math.max(0, elapsedSpan - evaluated - excluded) : 0;
  const derivedMoving = metric(
    movingPairs ? moving : null,
    's',
    'derived',
    'interval-speed-v1',
    possible > 0 && movingPairs === possible && a.segments.length === 1 && unobserved < 0.001,
    {
      evaluatedSeconds: evaluated,
      excludedSeconds: excluded,
      unobservedSeconds: unobserved,
      invalidIntervals: invalid,
      evaluatedIntervals: movingPairs,
      totalIntervals: possible,
    },
    {
      thresholdMps: threshold,
      maxGapSeconds: c.maxGapSeconds,
      maxSpeedMps: c.maxSpeedMps,
      speedConvention: 'left sample or interval distance',
    },
  );
  let movingTime = source(a, 'totalMovingTime', 's');
  if (movingTime.value === null) movingTime = derivedMoving;
  const derivedGain = elevation(a, c);
  let gain = source(a, 'totalAscent', 'm');
  if (gain.value === null) gain = derivedGain;
  const derivedDistance = metric(
    distancePairs ? distance : null,
    'm',
    'derived',
    'interval-distance-v1',
    possible > 0 && distancePairs === possible && timed && invalid === 0,
    { evaluatedIntervals: distancePairs, totalIntervals: possible },
    { maxGapSeconds: c.maxGapSeconds, maxSpeedMps: c.maxSpeedMps },
  );
  let dist = source(a, 'totalDistance', 'm');
  if (dist.value === null) dist = derivedDistance;
  const s: Record<string, Metric> = {
    distance: dist,
    elapsedTime: elapsed,
    timerTime: source(a, 'totalTimerTime', 's'),
    movingTime,
    elevationGain: gain,
    derivedMovingTime: derivedMoving,
    derivedElevationGain: derivedGain,
    derivedDistance,
  };
  for (const [out, field, unit] of [
    ['averageHeartRate', 'avgHeartRate', 'bpm'],
    ['maxHeartRate', 'maxHeartRate', 'bpm'],
    ['averagePower', 'avgPower', 'W'],
  ] as const)
    s[out] = source(a, field, unit);
  s.averageSpeed = metric(null, 'm/s', 'derived', 'distance-over-duration-v1');
  for (const basis of ['timerTime', 'elapsedTime']) {
    const t = s[basis]!;
    if (dist.complete && t.complete && t.value && dist.value !== null) {
      s.averageSpeed = metric(
        dist.value / t.value,
        'm/s',
        'derived',
        'distance-over-duration-v1',
        true,
        undefined,
        { durationBasis: basis },
      );
      break;
    }
  }
  const speed = s.averageSpeed.value;
  s.averagePace = metric(
    speed && ['running', 'walking', 'hiking'].includes(a.sport ?? '') ? 1000 / speed : null,
    's/km',
    'derived',
    'inverse-average-speed-v1',
    true,
    undefined,
    s.averageSpeed.parameters,
  );
  for (const key of ['movingTime', 'elevationGain', 'distance'])
    if (s[key]!.value !== null && !s[key]!.complete)
      warn(warnings, 'partial_metric', a.id, `${key} is incomplete; inspect coverage.`);
  if (movingTime.value !== null && elapsed.value !== null && movingTime.value > elapsed.value)
    warn(warnings, 'inconsistent_duration', a.id, 'Moving time exceeds elapsed time.');
  a.summary = s;
}
