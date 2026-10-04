/* Every sentence the views show about a plan or a set of answers. Keeping them here means
   the wording can be read, reviewed and changed without opening a component. */

import type { Answers } from "./answers";
import { comfortOption, feelingOption, preferenceTag, SLOTS, SPORTS, type FeelingKey, type PreferenceKey, type SportKey } from "./catalog";
import { addDays, weekdayName, weekdayShortName } from "./dates";
import { activeVersion, availableAdjustments, dateAt, sortByOffset, type Plan, type Session } from "./plan";
import { sessionDayOffsets } from "./schedule";
import { describeLevel } from "./sessions";
import { rankSports, type RankedSport } from "./sports";
import { capitalize, pluralize, sessionCountLabel } from "./text";

const NUMBER_WORDS: Record<number, string> = {
  1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven",
};

function echoOf(key: PreferenceKey): string {
  return preferenceTag(key)?.echo ?? "";
}

/** How the chosen places read in a sentence: "outdoors", "at home". */
export function placeEchoes(answers: Answers): string[] {
  return answers.places.map(echoOf);
}

export function companyEchoes(answers: Answers): string[] {
  return answers.company.map(echoOf);
}

/** Places then company, which is how every summary lists them. */
export function preferenceEchoes(answers: Answers): string[] {
  return [...placeEchoes(answers), ...companyEchoes(answers)];
}

/** "10 min · 3 sessions · mornings" */
export function timeAnswerLine(answers: Answers): string {
  return `${answers.minutes} min · ${sessionCountLabel(answers.sessionsPerWeek)} · ${SLOTS[answers.slot].plural}`;
}

/** The recap above the sport suggestions. */
export function answersRecap(answers: Answers): string {
  const comfort = comfortOption(answers.comfort);
  const parts = [
    comfort?.echo,
    ...preferenceEchoes(answers),
    `${answers.minutes} min`,
    SLOTS[answers.slot].plural,
  ].filter(Boolean);
  return `From your answers: ${parts.join(", ")}.`;
}

/** The line under a suggested sport: the answers it matches, then time and days. */
export function suggestionSummary(sport: RankedSport, answers: Answers): string {
  const parts = [...sport.matches.map(tag => tag.echo), `${answers.minutes} min`, SLOTS[answers.slot].plural];
  return capitalize(parts.join(" · "));
}

/** "Running · 3 sessions · 10 min · mornings" */
export function planningKicker(sport: SportKey, answers: Answers): string {
  return `${SPORTS[sport].name} · ${sessionCountLabel(answers.sessionsPerWeek)} · ${answers.minutes} min · ${SLOTS[answers.slot].plural}`;
}

export interface PlanningStep {
  label: string;
  caption?: string;
  /** Named checks, ticked off one at a time while the step runs. */
  parts?: string[];
}

/** What the planning moment says it is doing, in order. */
export function planningSteps(sport: SportKey, answers: Answers, today: Date): PlanningStep[] {
  const comfort = comfortOption(answers.comfort);
  const answered = [comfort?.echo ?? "", ...placeEchoes(answers)].filter(Boolean).join(" · ");
  const days = sessionDayOffsets(answers.sessionsPerWeek)
    .map(offset => weekdayName(addDays(today, offset)))
    .join(", ");
  const sessions = pluralize(answers.sessionsPerWeek, "session", "sessions");
  return [
    { label: "Reading your answers", caption: capitalize(`${answered} · ${answers.minutes} min`) },
    { label: `Drafting ${answers.sessionsPerWeek} ${SPORTS[sport].name.toLowerCase()} ${sessions}`, caption: days },
    { label: "Checking the plan", parts: ["Supported sport", "plan shape", "fits your days", "beginner scope"] },
    { label: "Saving your plan" },
  ];
}

/** The sentence under the plan's heading. */
export function planSummary(plan: Plan): string {
  const version = activeVersion(plan);
  const { minutes, slot } = version.params;
  const count = version.sessions.length;
  const first = version.sessions.find(session => session.index === 0) ?? sortByOffset(version.sessions)[0];
  const sessions = pluralize(count, "session", "sessions");
  return `${NUMBER_WORDS[count]} ${sessions} of ${minutes} min, ${SLOTS[slot].inPhrase}. ${first ? first.reason : ""}`;
}

/** How a completed session felt, in a sentence: "felt just right". */
export function feelingPhrase(session: Session): string {
  return session.done ? feelingOption(session.done.feeling).phrase : "";
}

/** "Today", "Tomorrow", or the weekday name. */
export function dayLabel(plan: Plan, offset: number): string {
  if (offset === plan.todayOffset) return "Today";
  if (offset === plan.todayOffset + 1) return "Tomorrow";
  return weekdayName(dateAt(plan, offset));
}

export interface PlanReason {
  key: string;
  icon: string;
  /** The answer or chat message behind this part of the plan. */
  cause: string;
  /** What it did to the plan. */
  effect: string;
  /** The version that changed it, or null when it still comes from the answers. */
  fromVersion: number | null;
}

/** "Why this plan": each parameter, what set it, and what it did. */
export function planReasons(plan: Plan): PlanReason[] {
  const version = activeVersion(plan);
  const params = version.params;
  const answers = plan.answers;
  const revisionOf = (key: keyof typeof params.origin) => {
    const origin = params.origin[key];
    return origin.kind === "revision" ? origin.version : null;
  };
  const versionLabel = (number: number) => plan.versions.find(candidate => candidate.number === number)?.label ?? "";
  /* The level and the sport name the change that set them; the rest read their own value,
     which the "You asked in chat" line already puts in context. */
  const causeFromRevisionOr = (key: keyof typeof params.origin, fromAnswers: string) => {
    const revision = revisionOf(key);
    return revision === null ? fromAnswers : versionLabel(revision);
  };

  const sessions = sortByOffset(version.sessions);
  const count = sessions.length;
  const days = sessions.map(session => weekdayShortName(dateAt(plan, session.offset))).join(", ");
  const restBetween = sessions.every((session, index) => index === 0 || session.offset - sessions[index - 1].offset > 1);
  const isBestFit = rankSports(answers)[0].key === params.sport;
  const sportFromAnswers = isBestFit ? capitalize(preferenceEchoes(answers).join(" · ")) : "Your pick";

  return [
    {
      key: "level",
      icon: "gauge",
      cause: causeFromRevisionOr("level", comfortOption(answers.comfort)?.label ?? ""),
      effect: describeLevel(params.sport, params.level, params.minutes),
      fromVersion: revisionOf("level"),
    },
    {
      key: "sport",
      icon: SPORTS[params.sport].icon,
      cause: causeFromRevisionOr("sport", sportFromAnswers),
      effect: SPORTS[params.sport].name,
      fromVersion: revisionOf("sport"),
    },
    {
      key: "minutes",
      icon: "timer",
      cause: `${params.minutes} min`,
      effect: `each session is ${params.minutes} minutes`,
      fromVersion: revisionOf("minutes"),
    },
    {
      key: "days",
      icon: "calendar-days",
      cause: sessionCountLabel(count),
      effect: count > 1 && restBetween ? `${days}, with rest between` : days,
      fromVersion: revisionOf("days"),
    },
    {
      key: "slot",
      icon: SLOTS[params.slot].icon,
      cause: capitalize(SLOTS[params.slot].plural),
      effect: `sessions ${SLOTS[params.slot].inPhrase}`,
      fromVersion: revisionOf("slot"),
    },
  ];
}

/** What the coach opens the chat with. */
export function openingMessages(plan: Plan): string[] {
  const opening = "This is your plan. Ask for a change in your own words, or pick a suggestion.";
  const completed = plan.sample ? activeVersion(plan).sessions.find(session => session.done) : undefined;
  if (completed) {
    const day = weekdayName(dateAt(plan, completed.offset));
    return [opening, `${day}'s walk is done. Whatever you change next, it stays as you did it.`];
  }
  return [opening, "Mark today's session done first, if you like. Whatever you change next, it stays as you did it."];
}

/** What the coach says after a session is marked done. */
export function feedbackReplies(plan: Plan, offset: number, feeling: FeelingKey, revisedOnce: boolean): string[] {
  const day = weekdayName(dateAt(plan, offset));
  const can = availableAdjustments(plan);
  const ask = can.easier ? "a bit easier" : can.shorter ? "shorter sessions" : null;
  const replies: Record<FeelingKey, string> = {
    easy: can.harder ? "Saved. Felt easy? You can ask for a bit more." : "Saved. Felt easy? That's a good start.",
    right: `Saved. ${day} stays as you did it, whatever you change next.`,
    hard: ask ? `Saved. Hard is normal at first. If it stays hard, ask for ${ask}.` : "Saved. Hard is normal at first.",
    much: ask
      ? `Saved. Stopping early still counts. Ask for ${ask} and the plan changes straight away.`
      : "Saved. Stopping early still counts.",
  };
  const out = [replies[feeling]];
  if (!revisedOnce) out.push(`Now try a change — ${day} stays exactly as you did it.`);
  return out;
}
