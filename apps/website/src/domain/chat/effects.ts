/* One function per change the chat can make. Each either refuses with a reason the
   reader can act on, or drafts the next version. None of them touch a completed session. */

import { MAX_LEVEL, MINUTES_RANGE, MIN_LEVEL, SLOTS, SPORTS, type SlotKey, type SportKey } from "../catalog";
import { DAYS_IN_WEEK, formatWeekdayAndDate, weekdayName } from "../dates";
import { activeVersion, dateAt, fromNextRevision, isKickabout, sessionAt, sortByOffset, upcomingSessions,
  type Plan } from "../plan";
import { buildSession, describeLevelValue, isWalkOnlyPlan } from "../sessions";
import { blueprintMatches, commitRevision, dayColumns, EVERY_SESSION_DONE, refuse, refuseWithoutNote, startDraft } from "./revision";
import type { ChatIntent, LastFeeling, RevisionOutcome } from "./types";

/** Move every session left this week to another time of day. */
export function moveToSlot(plan: Plan, intent: ChatIntent, slot: SlotKey, explanation: string): RevisionOutcome {
  const draft = startDraft(plan);
  for (const session of sortByOffset(draft.sessions)) {
    if (session.done || session.slot === slot) continue;
    draft.rows.push({ ...dayColumns(plan, session.offset), from: SLOTS[session.slot].label, to: SLOTS[slot].label });
    session.slot = slot;
  }
  draft.params.slot = slot;
  draft.params.origin.slot = fromNextRevision(plan);
  return commitRevision(plan, intent, draft, { explanation, label: `Moved to ${SLOTS[slot].plural}` });
}

/** The days a session could move to: forwards through the week first, then backwards. */
function moveCandidates(plan: Plan, from: number, occupied: Set<number>): number[] {
  const order: number[] = [];
  for (let day = from + 1; day < DAYS_IN_WEEK; day++) order.push(day);
  for (let day = from - 1; day >= 0; day--) order.push(day);
  return order.filter(day => day > plan.todayOffset && !occupied.has(day));
}

/** Move one day's session to a free day, preferring one with rest either side. */
export function moveSessionOffDay(plan: Plan, offset: number): RevisionOutcome {
  const intent: ChatIntent = "move";
  const version = activeVersion(plan);
  const date = dateAt(plan, offset);
  const dayName = weekdayName(date);
  const target = sessionAt(version, offset);
  if (!target) return refuse(intent, `There's nothing planned on ${dayName}.`);
  if (target.done) return refuse(intent, `${dayName} is done, so it stays as you did it.`);

  const occupied = new Set(version.sessions.filter(session => session.id !== target.id).map(session => session.offset));
  const candidates = moveCandidates(plan, offset, occupied);
  if (!candidates.length) return refuse(intent, "There's no free day left this week to move it to.");
  const withRestEitherSide = candidates.find(day => !occupied.has(day - 1) && !occupied.has(day + 1));
  const to = withRestEitherSide ?? candidates[0];
  const toName = weekdayName(dateAt(plan, to));

  const draft = startDraft(plan);
  const moved = draft.sessions.find(session => session.id === target.id);
  if (!moved) return refuse(intent, `There's nothing planned on ${dayName}.`);
  moved.offset = to;
  draft.params.origin.days = fromNextRevision(plan);
  draft.rows.push({ ...dayColumns(plan, to), from: formatWeekdayAndDate(date), to: formatWeekdayAndDate(dateAt(plan, to)) });
  return commitRevision(plan, intent, draft, {
    explanation: `${dayName}'s session moved to ${toName} — you said ${dayName} is busy.`,
    label: `Moved ${dayName} to ${toName}`,
  });
}

/** Direction of a change: -1 for shorter or easier, +1 for longer or harder. */
export type Direction = -1 | 1;

/** Make every session left this week shorter or longer, keeping the same days. */
export function changeLength(plan: Plan, intent: ChatIntent, direction: Direction): RevisionOutcome {
  const { minutes } = activeVersion(plan).params;
  if (direction < 0 && minutes <= MINUTES_RANGE.min) {
    return refuse(intent, `Sessions are already ${minutes} min, the shortest we plan.`);
  }
  if (direction > 0 && minutes >= MINUTES_RANGE.max) {
    return refuse(intent, `Sessions are already ${minutes} min, the longest we plan.`);
  }
  const newMinutes = minutes + direction * MINUTES_RANGE.step;
  const draft = startDraft(plan);
  for (const session of sortByOffset(draft.sessions)) {
    if (session.done) continue;
    const blueprint = buildSession(session.sport, {
      index: session.index,
      level: draft.params.level,
      minutes: newMinutes,
      kickabout: session.kickabout,
    });
    draft.rows.push({ ...dayColumns(plan, session.offset), from: `${session.minutes} min`, to: `${newMinutes} min` });
    session.title = blueprint.title;
    session.exercises = blueprint.exercises;
    session.minutes = newMinutes;
  }
  draft.params.minutes = newMinutes;
  draft.params.origin.minutes = fromNextRevision(plan);
  return commitRevision(plan, intent, draft, {
    explanation: direction < 0
      ? `Sessions are now ${newMinutes} min — you asked for shorter ones. Same days, fewer rounds.`
      : `Sessions are now ${newMinutes} min — you asked for longer ones. Same days, more rounds.`,
    label: direction < 0 ? "Shorter sessions" : "Longer sessions",
  });
}

const EASIER_LEAD: Record<SportKey, string> = {
  running: "Shorter run bits, longer walks",
  fitness: "Fewer reps",
  gym: "Fewer reps, still light",
  football: "Shorter drills",
};

/** Why the level moved, in the reader's own words where we have them. */
function levelCause(direction: Direction, plan: Plan, lastFeeling: LastFeeling | null): string {
  const feeling = lastFeeling?.feeling;
  const day = lastFeeling ? weekdayName(dateAt(plan, lastFeeling.offset)) : "";
  if (direction < 0) {
    if (feeling === "hard") return `you said ${day} felt hard`;
    if (feeling === "much") return `you said ${day} felt like too much`;
    return "you asked for easier";
  }
  return feeling === "easy" ? `you said ${day} felt easy` : "you asked for more";
}

/** Make the sessions left this week easier or harder, keeping their days and length. */
export function changeLevel(plan: Plan, intent: ChatIntent, direction: Direction, lastFeeling: LastFeeling | null): RevisionOutcome {
  const { sport, level, minutes } = activeVersion(plan).params;
  if (isWalkOnlyPlan(sport, minutes)) {
    return refuse(intent, direction < 0
      ? `At ${minutes} min every session is already a short walk, the gentlest we plan.`
      : `At ${minutes} min every session is a short walk. Ask for longer sessions first.`);
  }
  if (direction < 0 && level === MIN_LEVEL) return refuse(intent, "This is already the gentlest start. Try “Make it shorter” instead.");
  if (direction > 0 && level === MAX_LEVEL) return refuse(intent, "That's as much as a first week asks.");

  const newLevel = level + direction;
  const draft = startDraft(plan);
  for (const session of sortByOffset(draft.sessions)) {
    if (session.done) continue;
    const blueprint = buildSession(session.sport, {
      index: session.index,
      level: newLevel,
      minutes: session.minutes,
      kickabout: session.kickabout,
    });
    if (blueprintMatches(blueprint, session)) continue;
    const retitled = blueprint.title !== session.title;
    draft.rows.push({
      ...dayColumns(plan, session.offset),
      from: retitled ? session.title : describeLevelValue(session.sport, level),
      to: retitled ? blueprint.title : describeLevelValue(session.sport, newLevel),
    });
    session.title = blueprint.title;
    session.exercises = blueprint.exercises;
  }
  draft.params.level = newLevel;
  draft.params.origin.level = fromNextRevision(plan);
  const lead = direction < 0 ? EASIER_LEAD[sport] : sport === "running" ? "Longer run bits" : "A few more reps";
  return commitRevision(plan, intent, draft, {
    explanation: `${lead} — ${levelCause(direction, plan, lastFeeling)}.`,
    label: direction < 0 ? "A bit easier" : "A bit harder",
  });
}

/** Drop the last session still to come, turning that day into a rest day. */
export function addRestDay(plan: Plan): RevisionOutcome {
  const intent: ChatIntent = "rest";
  const version = activeVersion(plan);
  const target = upcomingSessions(plan, version).pop();
  if (!target || version.sessions.length <= 1) return refuse(intent, "One session is the fewest we plan this week.");
  const dayName = weekdayName(dateAt(plan, target.offset));

  const draft = startDraft(plan);
  draft.sessions = draft.sessions.filter(session => session.id !== target.id);
  draft.params.sessionsPerWeek = draft.sessions.length;
  draft.params.origin.days = fromNextRevision(plan);
  draft.rows.push({ ...dayColumns(plan, target.offset), from: target.title, to: "Rest day" });
  return commitRevision(plan, intent, draft, {
    explanation: `${dayName} is now a rest day — you asked for more rest.`,
    label: "One more rest day",
    removed: true,
  });
}

/** The same refusal whether the pipeline or the effect notices, so the wording stays in one place. */
export function refuseSameSport(sport: SportKey): RevisionOutcome {
  return refuse("switch", `This is already a ${SPORTS[sport].name.toLowerCase()} plan.`);
}

/** Rebuild every session still to come as another sport, from the next one onwards. */
export function switchSport(plan: Plan, sport: SportKey): RevisionOutcome {
  const intent: ChatIntent = "switch";
  const version = activeVersion(plan);
  const params = version.params;
  const lowercaseName = SPORTS[sport].name.toLowerCase();
  if (params.sport === sport) return refuseSameSport(sport);

  const draft = startDraft(plan);
  const lastIndex = Math.max(...draft.sessions.map(session => session.index));
  const open = sortByOffset(draft.sessions.filter(session => !session.done));
  if (!open.length) return refuseWithoutNote(intent, EVERY_SESSION_DONE);
  for (const session of open) {
    const kickabout = isKickabout(sport, params.withOthers, draft.sessions.length, session.index, lastIndex);
    const blueprint = buildSession(sport, { index: session.index, level: params.level, minutes: session.minutes, kickabout });
    draft.rows.push({ ...dayColumns(plan, session.offset), from: session.title, to: blueprint.title });
    session.sport = sport;
    session.title = blueprint.title;
    session.exercises = blueprint.exercises;
    session.kickabout = kickabout;
  }
  draft.params.sport = sport;
  draft.params.origin.sport = fromNextRevision(plan);
  const fromDay = open[0].offset === plan.todayOffset ? "today" : weekdayName(dateAt(plan, open[0].offset));
  return commitRevision(plan, intent, draft, {
    explanation: `Switched to ${lowercaseName} from ${fromDay} — you asked to try it.`,
    label: `Switched to ${lowercaseName}`,
  });
}
