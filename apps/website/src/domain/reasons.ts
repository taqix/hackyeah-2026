/* Why a session looks the way it does. Every session carries one of these lines,
   so the plan can always point back at the answer behind it. */

import { SLOTS, SPORTS, type ComfortValue, type SlotKey, type SportKey } from "./catalog";
import { capitalize } from "./text";

export interface SessionReasonInput {
  sport: SportKey;
  /** 0-based position in the week. */
  index: number;
  kickabout: boolean;
  comfort: ComfortValue | null;
  slot: SlotKey;
  /** Whether the day before this session is a rest day. */
  restBefore: boolean;
}

function firstSessionReason(sport: SportKey, comfort: ComfortValue | null): string {
  if (comfort === "scratch") {
    return sport === "running"
      ? "Starts as walking — you said you're starting from scratch."
      : "Starts gently — you said you're starting from scratch.";
  }
  if (comfort === "occasional") return "A short first session — you said you move now and then.";
  return "A bit more from day one — you already move most weeks.";
}

export function sessionReason({ sport, index, kickabout, comfort, slot, restBefore }: SessionReasonInput): string {
  if (kickabout) return "With others — you said you'd like company.";
  if (index === 0) return firstSessionReason(sport, comfort);
  if (index === 1) return `${capitalize(SLOTS[slot].inPhrase)} — you said ${SLOTS[slot].plural} suit you.`;
  return restBefore
    ? "A rest day before it, so you start fresh."
    : "Back to back with yesterday — keep it at talk pace.";
}

/** The note at the top of an open session: sport advice, then time-of-day advice. */
export function coachTip(sport: SportKey, slot: SlotKey): string {
  return `${SPORTS[sport].tip} ${SLOTS[slot].tip} Stopping early still counts.`;
}
