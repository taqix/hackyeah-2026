/* What a chat request can turn into: a refusal, or a new plan version ready to apply. */

import type { FeelingKey } from "../catalog";
import type { Version } from "../plan";

/** What the message was understood as. Kept on the outcome so replies can be traced. */
export type ChatIntent =
  | "health"
  | "scope"
  | "other-sport"
  | "busy"
  | "busy-slot"
  | "move"
  | "slot"
  | "slot-swap"
  | "easier"
  | "harder"
  | "shorter"
  | "longer"
  | "rest"
  | "switch"
  | "fallback";

/** One line of a change card: the day, and a value as it was and is now. */
export interface ChangeRow {
  offset: number;
  day: string;
  date: string;
  from: string;
  to: string;
}

/** The part of an accepted change the chat log keeps. */
export interface RevisionSummary {
  version: number;
  rows: ChangeRow[];
  /** What stays as it was, named explicitly: "Monday stays exactly as you did it." */
  foot: string;
}

export interface RefusedRevision {
  ok: false;
  intent: ChatIntent;
  text: string;
}

export interface AcceptedRevision {
  ok: true;
  intent: ChatIntent;
  label: string;
  explanation: string;
  rows: ChangeRow[];
  foot: string;
  version: number;
  /** The version to make active, once applied. */
  nextVersion: Version;
}

export type RevisionOutcome = RefusedRevision | AcceptedRevision;

/** How the last completed session felt, which colours the chat's wording. */
export interface LastFeeling {
  feeling: FeelingKey;
  offset: number;
}
