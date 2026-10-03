/* The machinery every chat change shares: drafting a copy of the plan, deciding what
   actually changed, and turning that into a version — or into a refusal. */

import { dateAt, activeVersion, clonePlanParams, cloneSessions, nextVersionNumber, sortByOffset,
  type Plan, type PlanParams, type Session, type Version } from "../plan";
import { formatDayAndMonth, weekdayName, weekdayShortName } from "../dates";
import type { SessionBlueprint, SessionExercise } from "../sessions";
import { joinWithAnd } from "../text";
import type { AcceptedRevision, ChangeRow, ChatIntent, RefusedRevision, RevisionOutcome } from "./types";

/** Every refusal reassures the reader that nothing happened to their plan. */
const UNCHANGED_NOTE = " Your plan hasn't changed.";

export const EVERY_SESSION_DONE = "Every session this week is done. Nothing left to change here.";

export function refuse(intent: ChatIntent, text: string): RefusedRevision {
  return { ok: false, intent, text: text + UNCHANGED_NOTE };
}

/** For the few refusals whose wording already covers it. */
export function refuseWithoutNote(intent: ChatIntent, text: string): RefusedRevision {
  return { ok: false, intent, text };
}

function sameExercises(before: SessionExercise[], after: SessionExercise[]): boolean {
  return before.length === after.length && before.every((exercise, index) =>
    exercise.name === after[index].name &&
    exercise.detail === after[index].detail &&
    exercise.meta === after[index].meta &&
    exercise.seconds === after[index].seconds);
}

/** Whether a session the change rewrote actually differs from the one it replaced. */
function sessionChanged(before: Session, after: Session): boolean {
  return before.title !== after.title ||
    before.slot !== after.slot ||
    before.offset !== after.offset ||
    before.minutes !== after.minutes ||
    before.sport !== after.sport ||
    !sameExercises(before.exercises, after.exercises);
}

/** Whether rebuilding a session at a new level or length produced anything different. */
export function blueprintMatches(blueprint: SessionBlueprint, session: Session): boolean {
  return blueprint.title === session.title && sameExercises(blueprint.exercises, session.exercises);
}

/** A session's day, as a change card's first column. */
export function dayColumns(plan: Plan, offset: number): Pick<ChangeRow, "offset" | "day" | "date"> {
  const date = dateAt(plan, offset);
  return { offset, day: weekdayShortName(date), date: formatDayAndMonth(date) };
}

/** A working copy of the active version. Effects edit the draft, then commit it. */
export interface RevisionDraft {
  version: Version;
  params: PlanParams;
  sessions: Session[];
  rows: ChangeRow[];
}

export function startDraft(plan: Plan): RevisionDraft {
  const version = activeVersion(plan);
  return { version, params: clonePlanParams(version), sessions: cloneSessions(version), rows: [] };
}

/** Names the completed sessions a change leaves alone, which is the promise the demo makes. */
function keptSentence(plan: Plan, sessions: Session[]): string {
  const doneDays = sortByOffset(sessions.filter(session => session.done))
    .map(session => weekdayName(dateAt(plan, session.offset)));
  if (doneDays.length === 0) return "Everything else stays the same.";
  if (doneDays.length === 1) return `${doneDays[0]} stays exactly as you did it.`;
  return `${joinWithAnd(doneDays)} stay exactly as you did them.`;
}

export interface CommitInput {
  label: string;
  explanation: string;
  /** Set when the change removes a session, which no session diff can show. */
  removed?: boolean;
}

/** Turn a draft into the next version, or refuse when nothing about the week would change.
    Sessions already done are never touched; changed ones carry the explanation as their reason. */
export function commitRevision(plan: Plan, intent: ChatIntent, draft: RevisionDraft,
  { label, explanation, removed = false }: CommitInput): RevisionOutcome {
  const number = nextVersionNumber(plan);
  const before = new Map(draft.version.sessions.map(session => [session.id, session]));
  const sessions = sortByOffset(draft.sessions).map(session => {
    const previous = before.get(session.id);
    const rewritten = !session.done && previous && sessionChanged(previous, session);
    return rewritten ? { ...session, changedIn: number, reason: explanation } : session;
  });
  const changedAnything = removed || sessions.some(session => session.changedIn === number);
  if (!changedAnything || !draft.rows.length) {
    return refuse(intent, "That wouldn't change any session left this week.");
  }
  const accepted: AcceptedRevision = {
    ok: true,
    intent,
    label,
    explanation,
    rows: draft.rows,
    foot: keptSentence(plan, sessions),
    version: number,
    nextVersion: { number, label, at: null, params: { ...draft.params, origin: { ...draft.params.origin } }, sessions },
  };
  return accepted;
}

/** An accepted change becomes the active version straight away. */
export function applyRevision(plan: Plan, outcome: RevisionOutcome, now: Date): Plan {
  if (!outcome.ok) return plan;
  const version = { ...outcome.nextVersion, at: now };
  return { ...plan, active: version.number, versions: [...plan.versions, version] };
}

/** Undo the newest change: back to the version before it, keeping anything marked done since. */
export function undoLastRevision(plan: Plan): Plan {
  if (plan.versions.length < 2) return plan;
  const undone = plan.versions[plan.versions.length - 1];
  const restored = plan.versions[plan.versions.length - 2];
  const doneSince = new Map(undone.sessions.filter(session => session.done).map(session => [session.id, session]));
  const sessions = restored.sessions.map(session => {
    const completedSince = doneSince.get(session.id);
    return !session.done && completedSince ? completedSince : session;
  });
  return { ...plan, active: restored.number, versions: [...plan.versions.slice(0, -2), { ...restored, sessions }] };
}
