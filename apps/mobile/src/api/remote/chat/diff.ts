/**
 * The change card's rows, worked out on the client: the product API stores a
 * chat change as a new plan version, so the card compares it with the version
 * before it, activity by activity (activity IDs stay the same across
 * revisions). Pure; times and days are device-local like the rest of the app.
 */
import { formatTime, toLocalDate } from '../../../lib/dates';
import type { ChangeDiff, ChangeRow, PlanChange } from '../../types';
import type { ToAppSportId } from '../mappers';
import type { PlannedActivity, PlanVersionEntity } from '../wire';

/** The lock line, when the changed week has done sessions. */
export const KEPT_LINE = 'Done sessions stay as you did them.';
/** A row whose day, time and length stayed: only the workout itself changed. */
export const DETAILS_NOTE = 'New details for this session.';

export interface VersionDiff {
  /** One row per changed session, in day order, without the skipped ones. */
  rows: ChangeRow[];
  /** Every activity that differs between the two versions, rows or not (the Undo lock checks these). */
  changedIds: string[];
  sport_switch: PlanChange['sport_switch'];
}

export interface DiffOptions {
  toAppSportId: ToAppSportId;
  /** Activities that never become rows: sessions already done when the change was made. */
  skip?: ReadonlySet<string>;
}

const startMs = (activity: PlannedActivity) => Date.parse(activity.start_at);

/** Same session, same plan: compared by meaning, so an offset written differently is no change. */
function sameActivity(a: PlannedActivity, b: PlannedActivity): boolean {
  return (
    a.sport_id === b.sport_id &&
    a.title === b.title &&
    a.description === b.description &&
    startMs(a) === startMs(b) &&
    a.duration_minutes === b.duration_minutes &&
    JSON.stringify(a.gym_exercises) === JSON.stringify(b.gym_exercises)
  );
}

/** Day, time and length changes, old → new. Durations are seconds, like the rest of the app. */
function whenDiffs(before: PlannedActivity, after: PlannedActivity): ChangeDiff[] {
  const diffs: ChangeDiff[] = [];
  const [dayFrom, dayTo] = [toLocalDate(before.start_at), toLocalDate(after.start_at)];
  const [timeFrom, timeTo] = [formatTime(before.start_at), formatTime(after.start_at)];
  if (dayFrom !== dayTo) diffs.push({ field: 'date', from: dayFrom, to: dayTo });
  if (timeFrom !== timeTo) diffs.push({ field: 'time', from: timeFrom, to: timeTo });
  if (before.duration_minutes !== after.duration_minutes) {
    diffs.push({ field: 'duration', from: before.duration_minutes * 60, to: after.duration_minutes * 60 });
  }
  return diffs;
}

function row(kind: ChangeRow['kind'], activity: PlannedActivity, toApp: ToAppSportId, extra: Partial<ChangeRow> = {}): ChangeRow {
  return {
    kind,
    session_id: activity.id,
    date: toLocalDate(activity.start_at),
    title: activity.title,
    was_title: null,
    sport_id: toApp(activity.sport_id),
    diffs: [],
    note: null,
    ...extra,
  };
}

/** A session that stayed in the plan but changed: swapped (other workout), moved (other day) or changed. */
function pairRow(before: PlannedActivity, after: PlannedActivity, toApp: ToAppSportId): ChangeRow {
  const diffs = whenDiffs(before, after);
  if (before.sport_id !== after.sport_id || before.title !== after.title) {
    return row('swapped', after, toApp, { diffs, was_title: before.title !== after.title ? before.title : null });
  }
  const moved = diffs.some((diff) => diff.field === 'date');
  return row(moved ? 'moved' : 'changed', after, toApp, { diffs, note: diffs.length ? null : DETAILS_NOTE });
}

/**
 * A sport switch ("Can I try the gym instead?"): every changed session left
 * one sport for one other. Kept sessions must all have switched; removed and
 * added ones count on their side.
 */
function sportSwitch(
  pairs: { before: PlannedActivity; after: PlannedActivity }[],
  removed: PlannedActivity[],
  added: PlannedActivity[],
  toApp: ToAppSportId,
): PlanChange['sport_switch'] {
  if (pairs.some((pair) => pair.before.sport_id === pair.after.sport_id)) return null;
  const from = new Set([...pairs.map((pair) => pair.before.sport_id), ...removed.map((a) => a.sport_id)]);
  const to = new Set([...pairs.map((pair) => pair.after.sport_id), ...added.map((a) => a.sport_id)]);
  if (from.size !== 1 || to.size !== 1) return null;
  const [fromId] = from;
  const [toId] = to;
  return fromId === toId ? null : { from: toApp(fromId), to: toApp(toId) };
}

/** What changed from `before` (null: nothing planned yet) to `after`, by activity ID. */
export function diffVersions(
  before: PlanVersionEntity | null,
  after: PlanVersionEntity,
  { toAppSportId, skip = new Set() }: DiffOptions,
): VersionDiff {
  const old = new Map((before?.plan.activities ?? []).map((activity) => [activity.id, activity]));
  const next = new Map(after.plan.activities.map((activity) => [activity.id, activity]));

  const pairs: { before: PlannedActivity; after: PlannedActivity }[] = [];
  const added: PlannedActivity[] = [];
  const removed = [...old.values()].filter((activity) => !next.has(activity.id));
  for (const activity of next.values()) {
    const was = old.get(activity.id);
    if (!was) added.push(activity);
    else if (!sameActivity(was, activity)) pairs.push({ before: was, after: activity });
  }

  const sorted: { at: number; row: ChangeRow }[] = [];
  const keep = (activity: PlannedActivity) => !skip.has(activity.id);
  for (const pair of pairs.filter((p) => keep(p.after))) {
    sorted.push({ at: startMs(pair.after), row: pairRow(pair.before, pair.after, toAppSportId) });
  }
  for (const activity of added.filter(keep)) {
    const diffs: ChangeDiff[] = [
      { field: 'time', from: null, to: formatTime(activity.start_at) },
      { field: 'duration', from: null, to: activity.duration_minutes * 60 },
    ];
    sorted.push({ at: startMs(activity), row: row('added', activity, toAppSportId, { diffs }) });
  }
  for (const activity of removed.filter(keep)) {
    sorted.push({ at: startMs(activity), row: row('removed', activity, toAppSportId) });
  }
  sorted.sort((a, b) => a.at - b.at || a.row.title.localeCompare(b.row.title));

  return {
    rows: sorted.map((entry) => entry.row),
    changedIds: [...pairs.map((pair) => pair.after.id), ...added.map((a) => a.id), ...removed.map((a) => a.id)],
    sport_switch: sportSwitch(pairs, removed, added, toAppSportId),
  };
}
