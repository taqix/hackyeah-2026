/**
 * The mock planner: turns answers and free time into sessions. It follows the
 * plan rules from design/README.md: sessions_per_week spread with rest days,
 * session_minutes long, starting at the preferred window's start (7:00 for any
 * time), inside free calendar time when given (else outside the window, which
 * Home flags), only sports the person can do where they can do them, and one
 * optional new activity a week for "occasionally try something new".
 */
import {
  addDays,
  atLocalTime,
  capitalize,
  diffDays,
  formatDayLong,
  formatWeekRange,
  joinAnd,
  numberWord,
  toIsoWithOffset,
} from '../../lib/dates';
import { effectiveDiscovery } from '../../lib/preference-options';
import { sessionLocalDate, sessionMinutes, sortSessions } from '../../lib/sessions';
import type { LocalDate, PlannedSession, Preferences, SportDefinition, TimeSlot } from '../types';
import { asNewIdea, canDo, nounOf, templateForSport, workoutFor, type TemplateKey } from './templates';

export interface PlanWindow {
  from: LocalDate;
  to: LocalDate;
  /** The plan version the new sessions belong to. */
  version: number;
  /** Non-optional sessions to plan; defaults to sessions_per_week. */
  count?: number;
  /** Add the week's optional new activity (weekly plans; never the first plan). */
  newIdea?: boolean;
  /** Nothing starts before this moment (a plan built today). */
  notBefore?: Date;
  newId: () => string;
}

/** Sports tried when the person explores, in this order. */
const EXPLORE_ORDER = ['walking', 'mobility', 'strength', 'running', 'cycling', 'swimming', 'football'];

/** Candidates for the optional new activity, in rotation. */
const NEW_IDEAS: { sport_id: string; key: TemplateKey }[] = [
  { sport_id: 'mobility', key: 'stretching' },
  { sport_id: 'walking', key: 'hill_walk' },
  { sport_id: 'strength', key: 'home_strength' },
  { sport_id: 'swimming', key: 'easy_swim' },
  { sport_id: 'cycling', key: 'bike_ride' },
  { sport_id: 'football', key: 'kickabout' },
];

const QUARTER = 15 * 60_000;
const roundUp = (t: number) => Math.ceil(t / QUARTER) * QUARTER;

/** Whether a sport can go into a plan for this person. */
export function plannable(sportId: string, prefs: Preferences, catalog: SportDefinition[]): boolean {
  const sport = catalog.find((s) => s.id === sportId);
  return (
    !!sport && sport.availability === 'working' && !prefs.excluded_activity_types.includes(sportId) && canDo(sportId, prefs)
  );
}

/** The sports a plan rotates through. */
export function planSports(prefs: Preferences, catalog: SportDefinition[]): string[] {
  const ok = (id: string) => plannable(id, prefs, catalog);
  const interests = prefs.activity_interests.filter(ok);
  const explore = EXPLORE_ORDER.filter(ok);
  if (effectiveDiscovery(prefs) === 'explore') return [...new Set([...interests, ...explore])];
  if (interests.length) return interests;
  return explore.length ? explore : ['mobility'];
}

/**
 * The start for a session on `date`: the first fitting time inside the
 * preferred window (within free time when given), else the first fitting time
 * between 7:00 and 21:00, preferring after the window. Null if nothing fits.
 */
export function slotFor(
  date: LocalDate,
  minutes: number,
  prefs: Pick<Preferences, 'preferred_window'>,
  freeSlots: TimeSlot[] | null,
  notBefore?: Date,
): Date | null {
  const length = minutes * 60_000;
  const dayStart = atLocalTime(date, 7).getTime();
  const dayEnd = atLocalTime(date, 21).getTime();
  const [ws, we] = prefs.preferred_window ?? [7, 21];
  const winStart = atLocalTime(date, ws).getTime();
  const winEnd = atLocalTime(date, we).getTime();
  const floor = Math.max(dayStart, notBefore ? roundUp(notBefore.getTime()) : 0);
  const intervals = (
    freeSlots
      ? freeSlots.map((s) => {
          const start = new Date(s.start).getTime();
          return [start, start + s.duration * 1000] as const;
        })
      : [[dayStart, dayEnd] as const]
  )
    .map(([a, b]) => [Math.max(a, floor), Math.min(b, dayEnd)] as const)
    .filter(([a, b]) => b - a >= length)
    .sort((x, y) => x[0] - y[0]);

  const fit = (from: number, to: number) => {
    for (const [a, b] of intervals) {
      const start = roundUp(Math.max(a, from));
      if (start + length <= Math.min(b, to)) return new Date(start);
    }
    return null;
  };
  return fit(winStart, winEnd) ?? fit(winEnd, dayEnd) ?? fit(dayStart, dayEnd);
}

/** Days for `count` sessions spread over the range with rest days, from the usable ones. */
function spreadDays(days: LocalDate[], usable: Set<LocalDate>, count: number): LocalDate[] {
  const chosen: LocalDate[] = [];
  for (let i = 0; i < count; i += 1) {
    const ideal = Math.floor((i * days.length) / count);
    const after = days.slice(ideal).find((d) => usable.has(d) && !chosen.includes(d));
    const before = [...days.slice(0, ideal)].reverse().find((d) => usable.has(d) && !chosen.includes(d));
    const day = after ?? before;
    if (day) chosen.push(day);
  }
  return chosen.sort();
}

function makeSession(
  window: PlanWindow,
  sport_id: string,
  key: TemplateKey,
  date: LocalDate,
  start: Date,
  prefs: Preferences,
  optional: boolean,
): PlannedSession {
  const base = workoutFor(key, prefs.session_minutes, prefs);
  const workout = optional ? asNewIdea(base) : base;
  return {
    id: window.newId(),
    sport_id,
    title: workout.title,
    time_slot: { start: toIsoWithOffset(start), duration: prefs.session_minutes * 60 },
    description: workout.description,
    status: 'planned',
    editable: true,
    plan_version: window.version,
    optional,
    changed_in_version: null,
    log_id: null,
    ...workout.details,
  };
}

/**
 * Sessions for the days in [from, to]. `existing` is every session so far: days
 * that already hold one are left alone, and sports rotate on from history.
 */
export function generatePlanWeek(
  prefs: Preferences,
  catalog: SportDefinition[],
  window: PlanWindow,
  freeSlots: TimeSlot[] | null,
  existing: PlannedSession[],
): PlannedSession[] {
  const span = diffDays(window.from, window.to) + 1;
  if (span <= 0) return [];
  const days = Array.from({ length: span }, (_, i) => addDays(window.from, i));
  const taken = new Set(existing.filter((s) => s.status !== 'skipped').map(sessionLocalDate));
  const starts = new Map<LocalDate, Date>();
  for (const day of days) {
    if (taken.has(day)) continue;
    const start = slotFor(day, prefs.session_minutes, prefs, freeSlots, window.notBefore);
    if (start) starts.set(day, start);
  }
  const usable = new Set(starts.keys());
  const count = Math.max(0, Math.min(window.count ?? prefs.sessions_per_week, usable.size));
  const chosen = spreadDays(days, usable, count);

  const sports = planSports(prefs, catalog);
  const history = existing.filter((s) => !s.optional);
  const offset = history.length;
  const perSport = new Map<string, number>();
  for (const s of history) perSport.set(s.sport_id, (perSport.get(s.sport_id) ?? 0) + 1);

  const sessions = chosen.map((day, i) => {
    const sport = sports[(offset + i) % sports.length];
    const n = perSport.get(sport) ?? 0;
    perSport.set(sport, n + 1);
    return makeSession(window, sport, templateForSport(sport, prefs, n), day, starts.get(day)!, prefs, false);
  });

  if (window.newIdea && effectiveDiscovery(prefs) === 'occasional') {
    const ideas = NEW_IDEAS.filter(
      (idea) =>
        plannable(idea.sport_id, prefs, catalog) &&
        (idea.key === 'hill_walk'
          ? prefs.activity_interests.includes('walking') && prefs.available_locations.includes('outdoors')
          : !prefs.activity_interests.includes(idea.sport_id)),
    );
    const tried = existing.filter((s) => s.optional).length;
    const idea = ideas.length ? ideas[tried % ideas.length] : null;
    const free = [...usable].filter((d) => !chosen.includes(d));
    // Prefer a day away from the planned sessions.
    const day =
      free.find((d) => chosen.every((c) => Math.abs(diffDays(c, d)) > 1)) ??
      free.find((d) => chosen.every((c) => c !== d));
    if (idea && day) sessions.push(makeSession(window, idea.sport_id, idea.key, day, starts.get(day)!, prefs, true));
  }
  return sortSessions(sessions);
}

/** Home's line under the week (app copy). The first week gets the reassurance. */
export function summarizeWeek(sessions: PlannedSession[], firstWeek: boolean): string | null {
  const live = sortSessions(sessions.filter((s) => s.status !== 'skipped'));
  const main = live.filter((s) => !s.optional);
  const optional = live.find((s) => s.optional);
  if (!live.length) return null;
  if (firstWeek) {
    const n = main.length;
    const short = main.every((s) => sessionMinutes(s) <= 20) ? 'short ' : '';
    return n === 1
      ? `One ${short}session. There's no need to add more.`
      : `${capitalize(numberWord(n))} ${short}sessions, with rest days between. There's no need to add more.`;
  }
  const groups: { one: string; many: string; count: number }[] = [];
  for (const s of main) {
    const noun = nounOf(s);
    const group = groups.find((g) => g.one === noun.one);
    if (group) group.count += 1;
    else groups.push({ ...noun, count: 1 });
  }
  const items = groups.map((g) => (g.count === 1 ? g.one : `${numberWord(g.count)} ${g.many}`));
  if (optional) items.push(`one optional ${nounOf(optional).one.replace(/^an? /, '')} to try`);
  return `${capitalize(joinAnd(items))}.`;
}

/** Plan history's line for a week's plan: "walk-runs on Monday and Friday, and a hill walk to try." */
export function describeWeekPlan(sessions: PlannedSession[]): string {
  const live = sortSessions(sessions.filter((s) => s.status !== 'skipped'));
  const groups: { one: string; many: string; days: string[] }[] = [];
  for (const s of live.filter((x) => !x.optional)) {
    const noun = nounOf(s);
    const day = formatDayLong(sessionLocalDate(s));
    const group = groups.find((g) => g.one === noun.one);
    if (group) group.days.push(day);
    else groups.push({ ...noun, days: [day] });
  }
  let text = groups
    .map((g) => (g.days.length === 1 ? `${g.one} on ${g.days[0]}` : `${g.many} on ${joinAnd(g.days)}`))
    .join(', ');
  const optional = live.find((s) => s.optional);
  if (optional) text += `${text ? ', and ' : ''}${nounOf(optional).one} to try`;
  return text ? `${text}.` : 'no sessions.';
}

/** "Week 3, 19–25 Oct: walk-runs on Monday and Friday, and a hill walk to try." */
export function weeklyVersionSummary(weekNumber: number, weekStart: LocalDate, sessions: PlannedSession[]): string {
  return `Week ${weekNumber}, ${formatWeekRange(weekStart)}: ${describeWeekPlan(sessions)}`;
}
