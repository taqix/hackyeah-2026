/**
 * Plan weeks from the version history, pure. Each week is its newest
 * snapshot (a revision replaces its week, never adds to it), joined with
 * completions and local drafts by activity ID. A done session keeps the
 * version it was done in; a done activity that a later snapshot no longer
 * lists still shows, read from that version.
 */
import { addDays } from '../../../lib/dates';
import { sessionLocalDate, sortSessions } from '../../../lib/sessions';
import type { LocalDate, PlannedSession, PlanState } from '../../types';
import type { Draft } from '../drafts';
import { sessionFromActivity, type ToAppSportId } from '../mappers';
import type { ActivityCompletionEntity, PlannedActivity, PlanVersionEntity } from '../wire';

/** week_start → the highest version planned for that week. */
export function snapshotsByWeek(versions: PlanVersionEntity[]): Map<LocalDate, PlanVersionEntity> {
  const weeks = new Map<LocalDate, PlanVersionEntity>();
  for (const version of versions) {
    const known = weeks.get(version.plan.week_start);
    if (!known || version.version > known.version) weeks.set(version.plan.week_start, version);
  }
  return weeks;
}

/** The oldest planned Monday and the newest planned week's Sunday; nulls without a plan. */
export function planBounds(
  snapshots: Map<LocalDate, PlanVersionEntity>,
): Pick<PlanState, 'first_week_start' | 'planned_through'> {
  const weeks = [...snapshots.keys()].sort();
  if (!weeks.length) return { first_week_start: null, planned_through: null };
  return { first_week_start: weeks[0], planned_through: addDays(weeks[weeks.length - 1], 6) };
}

/** The version before `version` that planned the same week, or null for the week's first. */
export function previousOfWeek(version: PlanVersionEntity, versions: PlanVersionEntity[]): PlanVersionEntity | null {
  let previous: PlanVersionEntity | null = null;
  for (const candidate of versions) {
    if (candidate.plan.week_start !== version.plan.week_start || candidate.version >= version.version) continue;
    if (!previous || candidate.version > previous.version) previous = candidate;
  }
  return previous;
}

const sameSlot = (a: PlannedActivity, b: PlannedActivity) =>
  a.title === b.title &&
  a.sport_id === b.sport_id &&
  a.duration_minutes === b.duration_minutes &&
  Date.parse(a.start_at) === Date.parse(b.start_at);

/**
 * Home's Updated tag: the snapshot's version when it changed this activity's
 * title, start, length or sport compared with the week's previous version, or
 * added it. Null for the week's first version and for unchanged activities.
 */
export function changedInVersion(
  activity: PlannedActivity,
  snapshot: PlanVersionEntity,
  previous: PlanVersionEntity | null,
): number | null {
  if (!previous) return null;
  const before = previous.plan.activities.find((a) => a.id === activity.id);
  return before && sameSlot(before, activity) ? null : snapshot.version;
}

export interface ProjectionInput {
  /** Every version (history plus the active one), any order. */
  versions: PlanVersionEntity[];
  completions: ActivityCompletionEntity[];
  /** Logs not saved yet: their sessions already count as done. */
  drafts: Draft[];
  now: Date;
  toAppSportId: ToAppSportId;
}

/** Every planned session of every week, by start time. */
export function projectSessions(input: ProjectionInput): PlannedSession[] {
  const versionById = new Map(input.versions.map((version) => [version.id, version]));
  const completionOf = new Map(input.completions.map((completion) => [completion.activity_id, completion]));
  const draftOf = new Map(input.drafts.map((draft) => [draft.activity_id, draft]));

  const toSession = (activity: PlannedActivity, readFrom: PlanVersionEntity, changed: number | null): PlannedSession => {
    const completion = completionOf.get(activity.id) ?? null;
    const draft = completion ? null : (draftOf.get(activity.id) ?? null);
    const doneIn = versionById.get(completion?.plan_version_id ?? draft?.plan_version_id ?? '') ?? readFrom;
    const session = sessionFromActivity(activity, doneIn, {
      completion,
      draft,
      now: input.now,
      toAppSportId: input.toAppSportId,
    });
    return { ...session, changed_in_version: changed };
  };

  const sessions = new Map<string, PlannedSession>();
  for (const snapshot of snapshotsByWeek(input.versions).values()) {
    const previous = previousOfWeek(snapshot, input.versions);
    for (const activity of snapshot.plan.activities) {
      sessions.set(activity.id, toSession(activity, snapshot, changedInVersion(activity, snapshot, previous)));
    }
  }
  // Done work never disappears: read a done activity a later snapshot dropped from the version it was done in.
  for (const done of [...input.completions, ...input.drafts]) {
    if (sessions.has(done.activity_id)) continue;
    const version = versionById.get(done.plan_version_id);
    const activity = version?.plan.activities.find((a) => a.id === done.activity_id);
    if (version && activity) sessions.set(activity.id, toSession(activity, version, null));
  }
  return sortSessions([...sessions.values()]);
}

/** The sessions whose local day is in [from, to]. */
export function sessionsBetween(sessions: PlannedSession[], from: LocalDate, to: LocalDate): PlannedSession[] {
  return sessions.filter((session) => {
    const day = sessionLocalDate(session);
    return day >= from && day <= to;
  });
}
