/* The demo's own UI state: what the chat is showing, and which dialog is open. */

import type { RevisionSummary } from "../domain";

/** Omit over a union keeps every member, rather than collapsing them into one. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type ChatItem =
  | { id: string; fresh?: boolean; kind: "user" | "coach" | "refusal"; text: string }
  | { id: string; fresh?: boolean; kind: "checking" }
  | { id: string; fresh?: boolean; kind: "result"; summary: RevisionSummary; undone?: boolean }
  | { id: string; fresh?: boolean; kind: "closing"; kept: boolean };

/** A chat item before the reducer gives it an id. */
export type NewChatItem = DistributiveOmit<ChatItem, "id" | "fresh"> & { id?: string };

/** The session dialog shows the session, then asks how it felt. */
export interface SessionDialogState {
  offset: number;
  mode: "session" | "feedback";
}
