/**
 * Pure reading of a plan week for Home (design/prototype/home.jsx): which week
 * and day are shown, what each strip day holds, and the small copy around them.
 */
import type { ActivityLog, Felt, IsoDateTime, LocalDate, PlannedSession, PlanState, PlanWeek } from '@/api/types';
import {
  addDays,
  diffDays,
  formatDateShort,
  formatDayLong,
  formatTime,
  fromLocalDate,
  MONTHS_LONG,
  startOfWeek,
  toLocalDate,
  weekdayIndex,
} from '@/lib/dates';
import { nextPlannedSession, sessionLocalDate, sessionsOn, sessionStart } from '@/lib/sessions';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (value: string | string[] | undefined): LocalDate | undefined =>
  typeof value === 'string' && LOCAL_DATE.test(value) ? value : undefined;

/** The week and day Home shows, from the route params (chat's See week) or today. */
export function resolveSelection(
  params: { week?: string | string[]; day?: string | string[] },
  today: LocalDate,
  plan: Pick<PlanState, 'first_week_start' | 'planned_through'> | undefined,
): { weekStart: LocalDate; day: LocalDate } {
  const currentWeek = startOfWeek(today);
  const dayParam = validDate(params.day);
  const weekParam = validDate(params.week);
  let weekStart = weekParam ? startOfWeek(weekParam) : dayParam ? startOfWeek(dayParam) : currentWeek;
  if (plan) {
    const first = plan.first_week_start && plan.first_week_start < currentWeek ? plan.first_week_start : currentWeek;
    const lastPlanned = plan.planned_through ? startOfWeek(plan.planned_through) : currentWeek;
    const last = lastPlanned > currentWeek ? lastPlanned : currentWeek;
    if (weekStart < first) weekStart = first;
    if (weekStart > last) weekStart = last;
  }
  const inWeek = dayParam && dayParam >= weekStart && dayParam <= addDays(weekStart, 6);
  const day = inWeek ? dayParam : weekStart === currentWeek ? today : addDays(weekStart, weekdayIndex(today));
  return { weekStart, day };
}

/** The day's plan session: the first one not done when there are several, or null for a rest day. */
export function primarySession(week: PlanWeek, date: LocalDate): PlannedSession | null {
  const onDay = sessionsOn(week.sessions, date);
  return onDay.find((s) => s.status !== 'completed') ?? onDay[0] ?? null;
}

export type StripDayState = 'done' | 'planned' | 'unlogged' | 'skipped' | 'rest' | 'open';

export type StripDay = {
  date: LocalDate;
  state: StripDayState;
  session: PlannedSession | null;
};

/** What each day of the strip holds. A week with no sessions reads "nothing planned", not "rest". */
export function stripDays(week: PlanWeek, today: LocalDate): StripDay[] {
  const empty = !week.planned || week.sessions.length === 0;
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(week.week_start, i);
    const session = primarySession(week, date);
    let state: StripDayState;
    if (!session) state = empty ? 'open' : 'rest';
    else if (session.status === 'completed') state = 'done';
    else if (session.status === 'skipped') state = 'skipped';
    else state = date < today ? 'unlogged' : 'planned';
    return { date, state, session };
  });
}

/** "Wednesday 7, today, Walk-run intervals at 7:00". */
export function stripDayLabel(day: StripDay, isToday: boolean): string {
  const s = day.session;
  const what = {
    done: 'done',
    planned: s ? `${s.title} at ${formatTime(sessionStart(s))}${s.optional ? ', optional' : ''}` : '',
    rest: 'rest day',
    open: 'nothing planned',
    unlogged: s ? `${s.title}, not logged` : '',
    skipped: 'skipped',
  }[day.state];
  const date = fromLocalDate(day.date).getDate();
  return `${formatDayLong(day.date)} ${date}${isToday ? ', today' : ''}${what ? `, ${what}` : ''}`;
}

/** The next planned session on a later day than `date`, from this week or the next. */
export function nextSessionAfter(date: LocalDate, weeks: (PlanWeek | null | undefined)[]): PlannedSession | null {
  const sessions = weeks.flatMap((w) => (w ? w.sessions : []));
  return nextPlannedSession(sessions, fromLocalDate(addDays(date, 1)));
}

/** 5.6: the selected day is the week's last and every plan session is done or skipped. */
export function isWeekDone(week: PlanWeek, date: LocalDate): boolean {
  if (date !== week.week_end) return false;
  const counted = week.sessions.filter((s) => !s.optional);
  return counted.length > 0 && counted.every((s) => s.status !== 'planned');
}

/** "Wednesday, 7 October", with " · Week 1" once the plan has a first week. */
export function headerKicker(today: LocalDate, firstWeekStart: LocalDate | null | undefined): string {
  const d = fromLocalDate(today);
  const date = `${formatDayLong(today)}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
  if (!firstWeekStart) return date;
  const weeks = diffDays(firstWeekStart, startOfWeek(today)) / 7;
  return weeks >= 0 ? `${date} · Week ${Math.floor(weeks) + 1}` : date;
}

/** "Good morning, Ana", or the greeting alone when the account has no name. */
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}

/** When the Plan updated note's change happened: "last night", "this morning", "Tuesday". */
export function changedWhen(createdAt: IsoDateTime, now: Date): string {
  const created = new Date(createdAt);
  const days = diffDays(toLocalDate(created), toLocalDate(now));
  const hour = created.getHours();
  if (days <= 0) return hour < 12 ? 'this morning' : hour < 18 ? 'this afternoon' : 'this evening';
  if (days === 1) return hour >= 18 ? 'last night' : 'yesterday';
  if (days < 7) return formatDayLong(created);
  return formatDateShort(created);
}

const FELT: Record<Felt, string> = {
  easy: 'easy',
  just_right: 'just right',
  hard: 'hard',
  too_much: 'too much',
};

/** "felt just right" */
export function feltText(felt: Felt): string {
  return `felt ${FELT[felt]}`;
}

/** A row in the week's list: a plan session, or a workout added outside the plan. */
export type WeekRow =
  | { kind: 'session'; session: PlannedSession; date: LocalDate; at: number }
  | { kind: 'extra'; log: ActivityLog; date: LocalDate; at: number };

/** The week's sessions and extras by start time. */
export function weekRows(week: PlanWeek): WeekRow[] {
  const rows: WeekRow[] = [
    ...week.sessions.map((session) => ({
      kind: 'session' as const,
      session,
      date: sessionLocalDate(session),
      at: sessionStart(session).getTime(),
    })),
    ...week.extras.map((log) => {
      const start = new Date(log.started_at);
      return { kind: 'extra' as const, log, date: toLocalDate(start), at: start.getTime() };
    }),
  ];
  return rows.sort((a, b) => a.at - b.at);
}

/** "This week", "Last week", "Next week", or "Week of 28 Sep – 4 Oct". */
export function listTitle(word: string | null, range: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : `Week of ${range}`;
}
