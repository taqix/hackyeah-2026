/* The chips under the chat. They only ever offer changes the plan can actually make,
   and lead with the one the last session's feeling suggests. */

import { SLOTS } from "../catalog";
import { weekdayName } from "../dates";
import { activeVersion, availableAdjustments, dateAt, upcomingSessions, type Plan } from "../plan";
import { capitalize } from "../text";
import type { LastFeeling } from "./types";

export interface Chip {
  id: string;
  label: string;
  /** The message the chip sends, written as the reader would say it. */
  text: string;
  /** Set on the chip the last feeling makes most likely, which the UI highlights. */
  accent?: boolean;
}

const SHORTER: Chip = { id: "shorter", label: "Make it shorter", text: "Can the sessions be shorter?" };
const EASIER: Chip = { id: "easier", label: "A bit easier", text: "Can it be a bit easier?" };
const HARDER: Chip = { id: "harder", label: "A bit harder", text: "Can it be a bit harder?" };

export function suggestionChips(plan: Plan, lastFeeling: LastFeeling | null): Chip[] {
  const version = activeVersion(plan);
  const slot = SLOTS[version.params.slot];
  const chips: Chip[] = [{ id: "slot", label: `${capitalize(slot.plural)} are busy`, text: `${capitalize(slot.plural)} are busy.` }];

  const [nextSession] = upcomingSessions(plan, version);
  if (nextSession) {
    const day = weekdayName(dateAt(plan, nextSession.offset));
    chips.push({ id: "day", label: `Busy ${day}`, text: `I'm busy on ${day}.` });
  }

  const can = availableAdjustments(plan);
  const feeling = lastFeeling?.feeling;
  const struggled = feeling === "hard" || feeling === "much";

  if (struggled && can.easier) chips.unshift({ ...EASIER, accent: true });
  else if (struggled && can.shorter) chips.unshift({ ...SHORTER, accent: true });

  if (can.shorter && !(struggled && !can.easier)) chips.push(SHORTER);
  if (can.easier && !struggled) chips.push(EASIER);
  if (feeling === "easy" && can.harder) chips.unshift(HARDER);

  return chips;
}
