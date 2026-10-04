/* One message in, one decision out. The rules are tried in order: refusals first, so a
   message about pain or a marathon never reaches a change, then each kind of change. */

import { SLOTS } from "../catalog";
import { DAYS_IN_WEEK, weekdayIndexOf } from "../dates";
import { activeVersion, dateAt, hasOpenSessions, type Plan } from "../plan";
import { addRestDay, changeLength, changeLevel, moveSessionOffDay, moveToSlot, refuseSameSport, switchSport } from "./effects";
import { ASK_SLOT_PATTERNS, BUSY_SLOT_PATTERNS, firstMatch, PATTERNS, SLOT_FALLBACK, SWITCH_SPORT_PATTERNS, UNSUPPORTED_SPORTS } from "./patterns";
import { EVERY_SESSION_DONE, refuse, refuseWithoutNote } from "./revision";
import type { ChatIntent, LastFeeling, RevisionOutcome } from "./types";

export interface ChatContext {
  lastFeeling?: LastFeeling | null;
}

interface ChatRequest {
  plan: Plan;
  /** The message, lowercased and trimmed. */
  text: string;
  lastFeeling: LastFeeling | null;
}

/** A rule either decides the message or passes it on. */
type RevisionRule = (request: ChatRequest) => RevisionOutcome | null;

/** Changes only apply to sessions still to come, so an all-done week declines early. */
function ifAnyOpen(plan: Plan, intent: ChatIntent, change: () => RevisionOutcome): RevisionOutcome {
  return hasOpenSessions(activeVersion(plan)) ? change() : refuseWithoutNote(intent, EVERY_SESSION_DONE);
}

const refuseHealth: RevisionRule = ({ text }) =>
  PATTERNS.health.test(text)
    ? refuse("health", "Plans can't take pain or health conditions into account. If something hurts or you feel unwell, check with a doctor or physio.")
    : null;

const refuseOutOfScope: RevisionRule = ({ text }) => {
  const match = text.match(PATTERNS.scope);
  if (!match) return null;
  const phrase = match[1];
  if (/marathon|ultra|triathlon/.test(phrase)) {
    const article = /^[aeiou]/.test(phrase) ? "An" : "A";
    return refuse("scope", `${article} ${phrase} is beyond a beginner plan. Sessions can get a little longer instead.`);
  }
  if (/lose|weight/.test(phrase)) return refuse("scope", "This plan is about moving more, not weight.");
  return refuse("scope", "That's beyond a beginner first week.");
};

const refuseUnsupportedSport: RevisionRule = ({ text }) => {
  for (const [pattern, name] of UNSUPPORTED_SPORTS) {
    if (pattern.test(text)) return refuse("other-sport", `${name} isn't one of the sports we plan.`);
  }
  return null;
};

/** Which day of the plan a day word points at, or null when it names no day this week. */
function offsetForDayWord(plan: Plan, word: string): number | null {
  if (word === "today") return plan.todayOffset;
  if (word === "tomorrow") return plan.todayOffset + 1;
  const weekday = weekdayIndexOf(word);
  if (weekday < 0) return null;
  for (let offset = 0; offset < DAYS_IN_WEEK; offset++) {
    if (dateAt(plan, offset).getDay() === weekday) return offset;
  }
  return null;
}

/** "I'm busy on Monday" moves that session; "mornings are busy" moves the whole week. */
const handleBusy: RevisionRule = ({ plan, text }) => {
  if (!PATTERNS.busy.test(text)) return null;

  const dayWord = text.match(PATTERNS.day);
  if (dayWord) {
    const offset = offsetForDayWord(plan, dayWord[1]);
    if (offset !== null) return ifAnyOpen(plan, "move", () => moveSessionOffDay(plan, offset));
  }

  const busySlot = firstMatch(BUSY_SLOT_PATTERNS, text);
  if (busySlot) {
    const current = activeVersion(plan).params.slot;
    if (busySlot !== current) {
      return refuse("busy-slot", `Sessions are already ${SLOTS[current].inPhrase}, not ${SLOTS[busySlot].inPhrase}.`);
    }
    return ifAnyOpen(plan, "slot-swap", () => {
      const to = SLOT_FALLBACK[current];
      return moveToSlot(plan, "slot-swap", to, `Moved to ${SLOTS[to].plural} — you said ${SLOTS[current].plural} are busy.`);
    });
  }

  return refuse("busy", "Which day or time is busy? Try “Busy Monday” or “Mornings are busy”.");
};

const handleLevel: RevisionRule = ({ plan, text, lastFeeling }) => {
  if (PATTERNS.harder.test(text)) return ifAnyOpen(plan, "harder", () => changeLevel(plan, "harder", 1, lastFeeling));
  if (PATTERNS.easier.test(text)) return ifAnyOpen(plan, "easier", () => changeLevel(plan, "easier", -1, lastFeeling));
  return null;
};

const handleLength: RevisionRule = ({ plan, text }) => {
  if (PATTERNS.longer.test(text)) return ifAnyOpen(plan, "longer", () => changeLength(plan, "longer", 1));
  if (PATTERNS.shorter.test(text)) return ifAnyOpen(plan, "shorter", () => changeLength(plan, "shorter", -1));
  return null;
};

const handleAskedSlot: RevisionRule = ({ plan, text }) => {
  const asked = firstMatch(ASK_SLOT_PATTERNS, text);
  if (!asked) return null;
  if (asked === activeVersion(plan).params.slot) {
    return refuse("slot", `Sessions are already ${SLOTS[asked].inPhrase}.`);
  }
  return ifAnyOpen(plan, "slot", () =>
    moveToSlot(plan, "slot", asked, `Moved to ${SLOTS[asked].plural} — you asked for ${SLOTS[asked].plural}.`));
};

const handleRest: RevisionRule = ({ plan, text }) =>
  PATTERNS.rest.test(text) ? ifAnyOpen(plan, "rest", () => addRestDay(plan)) : null;

const handleSwitch: RevisionRule = ({ plan, text }) => {
  if (!PATTERNS.switchVerb.test(text)) return null;
  const sport = firstMatch(SWITCH_SPORT_PATTERNS, text);
  if (!sport) return null;
  if (sport === activeVersion(plan).params.sport) return refuseSameSport(sport);
  return ifAnyOpen(plan, "switch", () => switchSport(plan, sport));
};

/** Refusals first, then changes from the most specific wording to the most general. */
const RULES: RevisionRule[] = [
  refuseHealth,
  refuseOutOfScope,
  refuseUnsupportedSport,
  handleBusy,
  handleLevel,
  handleLength,
  handleAskedSlot,
  handleRest,
  handleSwitch,
];

export function reviseFromMessage(plan: Plan, input: string, context: ChatContext = {}): RevisionOutcome {
  const request: ChatRequest = {
    plan,
    text: String(input ?? "").toLowerCase().trim(),
    lastFeeling: context.lastFeeling ?? null,
  };
  for (const rule of RULES) {
    const outcome = rule(request);
    if (outcome) return outcome;
  }
  return refuseWithoutNote("fallback", "We couldn't turn that into a plan change. Try one of the suggestions — your plan hasn't changed.");
}
