/* A plan: one week of sessions, plus every version it has been through.
   Plans are immutable — changing one produces a new version, and completed
   sessions are carried across untouched. */

import { cloneAnswers, prefersCompany, type Answers } from "./answers";
import { comfortLevel, MAX_LEVEL, MINUTES_RANGE, MIN_LEVEL, SAMPLE_PLAN_SPORT, type FeelingKey, type SlotKey, type SportKey } from "./catalog";
import { addDays, MS_PER_DAY, startOfDay } from "./dates";
import { sessionReason } from "./reasons";
import { hasRestDayBefore, sessionDayOffsets } from "./schedule";
import { buildSession, isWalkOnlyPlan, type SessionExercise } from "./sessions";

export interface DoneRecord {
  feeling: FeelingKey;
  note: string;
  /** One flag per exercise, as ticked off during the session. */
  ticked: boolean[];
  /** The version the session was completed in. */
  version: number;
}

export interface Session {
  id: string;
  /** 0-based position in the week, which decides variety and the first-session wording. */
  index: number;
  /** Days from the plan's start. */
  offset: number;
  sport: SportKey;
  title: string;
  exercises: SessionExercise[];
  minutes: number;
  slot: SlotKey;
  reason: string;
  kickabout: boolean;
  done: DoneRecord | null;
  doneInVersion: number | null;
  /** The version that last changed this session, for the "Changed" badge. */
  changedIn: number | null;
}

/** Where a plan parameter came from: the questionnaire, or the chat change that made a version. */
export type ParamOrigin = { kind: "answers" } | { kind: "revision"; version: number };

export const FROM_ANSWERS: ParamOrigin = { kind: "answers" };

export type PlanParamKey = "level" | "minutes" | "slot" | "sport" | "days";

export interface PlanParams {
  sport: SportKey;
  /** 0–2 difficulty the session builders read. */
  level: number;
  minutes: number;
  slot: SlotKey;
  withOthers: boolean;
  sessionsPerWeek: number;
  origin: Record<PlanParamKey, ParamOrigin>;
}

export interface Version {
  number: number;
  label: string;
  /** When the version was saved; null until it is applied. */
  at: Date | null;
  params: PlanParams;
  sessions: Session[];
}

export interface Plan {
  start: Date;
  /** Which day of the week is today, as an offset from the start. */
  todayOffset: number;
  /** True for the seeded guest plan at `#/try/sample`. */
  sample: boolean;
  /** The version being shown. */
  active: number;
  /** The answers the plan was built from, kept as they were. */
  answers: Answers;
  versions: Version[];
}

export interface SessionFeedback {
  feeling: FeelingKey;
  note: string;
  ticked: boolean[];
}

export interface BuildPlanInput {
  answers: Answers;
  sport: SportKey;
  today: Date;
  now: Date;
  start?: Date;
  todayOffset?: number;
  sample?: boolean;
}

/** Football with others ends the week on a kickabout, once there is more than one session. */
export function isKickabout(sport: SportKey, withOthers: boolean, sessionCount: number, index: number, lastIndex: number): boolean {
  return sport === "football" && withOthers && sessionCount >= 2 && index === lastIndex;
}

export function buildPlan({ answers, sport, today, now, start, todayOffset = 0, sample = false }: BuildPlanInput): Plan {
  const level = comfortLevel(answers.comfort);
  const withOthers = prefersCompany(answers);
  const offsets = sessionDayOffsets(answers.sessionsPerWeek);
  const sessions = offsets.map((offset, index) => {
    const kickabout = isKickabout(sport, withOthers, offsets.length, index, offsets.length - 1);
    const blueprint = buildSession(sport, { index, level, minutes: answers.minutes, kickabout });
    return {
      id: `s${index}`,
      index,
      offset,
      sport,
      title: blueprint.title,
      exercises: blueprint.exercises,
      minutes: answers.minutes,
      slot: answers.slot,
      reason: sessionReason({
        sport,
        index,
        kickabout,
        comfort: answers.comfort,
        slot: answers.slot,
        restBefore: hasRestDayBefore(offsets, index),
      }),
      kickabout,
      done: null,
      doneInVersion: null,
      changedIn: null,
    } satisfies Session;
  });
  const params: PlanParams = {
    sport,
    level,
    minutes: answers.minutes,
    slot: answers.slot,
    withOthers,
    sessionsPerWeek: answers.sessionsPerWeek,
    origin: { level: FROM_ANSWERS, minutes: FROM_ANSWERS, slot: FROM_ANSWERS, sport: FROM_ANSWERS, days: FROM_ANSWERS },
  };
  return {
    start: start ?? startOfDay(today),
    todayOffset,
    sample,
    active: 1,
    answers: cloneAnswers(answers),
    versions: [{ number: 1, label: "First plan", at: now, params, sessions }],
  };
}

/** How far into the week the seeded guest plan starts, so it already has a session done. */
const SAMPLE_TODAY_OFFSET = 2;

/** The guest demo: a plan that started two days ago, with its first session completed. */
export function buildSamplePlan(today: Date, now: Date, answers: Answers): Plan {
  const plan = buildPlan({
    answers,
    sport: SAMPLE_PLAN_SPORT,
    today,
    now: new Date(now.getTime() - SAMPLE_TODAY_OFFSET * MS_PER_DAY),
    start: addDays(startOfDay(today), -SAMPLE_TODAY_OFFSET),
    todayOffset: SAMPLE_TODAY_OFFSET,
    sample: true,
  });
  const [firstSession] = plan.versions[0].sessions;
  firstSession.done = { feeling: "right", note: "", ticked: firstSession.exercises.map(() => true), version: 1 };
  firstSession.doneInVersion = 1;
  return plan;
}

export function activeVersion(plan: Plan): Version {
  const version = plan.versions.find(candidate => candidate.number === plan.active);
  if (!version) throw new Error(`Plan has no version ${plan.active}`);
  return version;
}

export function nextVersionNumber(plan: Plan): number {
  return plan.versions.length + 1;
}

/** The origin to stamp on a parameter a pending change is about to set. */
export function fromNextRevision(plan: Plan): ParamOrigin {
  return { kind: "revision", version: nextVersionNumber(plan) };
}

export function dateAt(plan: Plan, offset: number): Date {
  return addDays(plan.start, offset);
}

export function sessionAt(version: Version, offset: number): Session | null {
  return version.sessions.find(session => session.offset === offset) ?? null;
}

export function sortByOffset(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => a.offset - b.offset);
}

/** Sessions still open: not done, and not already in the past. */
export function upcomingSessions(plan: Plan, version: Version): Session[] {
  return sortByOffset(version.sessions.filter(session => !session.done && session.offset > plan.todayOffset));
}

export function hasOpenSessions(version: Version): boolean {
  return version.sessions.some(session => !session.done);
}

export function cloneSession(session: Session): Session {
  return {
    ...session,
    exercises: session.exercises.map(exercise => ({ ...exercise })),
    done: session.done ? { ...session.done, ticked: [...session.done.ticked] } : null,
  };
}

export function cloneSessions(version: Version): Session[] {
  return version.sessions.map(cloneSession);
}

export function clonePlanParams(version: Version): PlanParams {
  return { ...version.params, origin: { ...version.params.origin } };
}

/** Mark the session on a day done in the active version. Never creates a version. */
export function markSessionDone(plan: Plan, offset: number, { feeling, note, ticked }: SessionFeedback): Plan {
  const version = activeVersion(plan);
  const sessions = version.sessions.map(session =>
    session.offset === offset
      ? { ...session, done: { feeling, note, ticked: [...ticked], version: version.number }, doneInVersion: version.number }
      : session,
  );
  return {
    ...plan,
    versions: plan.versions.map(candidate => (candidate.number === version.number ? { ...version, sessions } : candidate)),
  };
}

/** What the chat can actually change, so replies and chips never offer a refused request. */
export interface Adjustments {
  easier: boolean;
  harder: boolean;
  shorter: boolean;
}

export function availableAdjustments(plan: Plan): Adjustments {
  const { sport, level, minutes } = activeVersion(plan).params;
  const walkOnly = isWalkOnlyPlan(sport, minutes);
  return {
    easier: level > MIN_LEVEL && !walkOnly,
    harder: level < MAX_LEVEL && !walkOnly,
    shorter: minutes > MINUTES_RANGE.min,
  };
}
