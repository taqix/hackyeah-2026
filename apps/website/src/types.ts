/* Shapes shared by the demo logic and the views. */

export interface Answers {
  comfort: string | null;
  places: string[];
  company: string[];
  sessions: number;
  minutes: number;
  slot: string;
}

/* One line of a session: what to do, how much, and a hint. `sec` is its share of the session. */
export interface SessionRow {
  name: string;
  detail: string;
  meta: string;
  sec: number;
}

export interface DoneRecord {
  feeling: string;
  note: string;
  ticked: boolean[];
  version: number;
}

export interface Session {
  id: string;
  index: number;
  offset: number;
  sport: string;
  title: string;
  rows: SessionRow[];
  minutes: number;
  slot: string;
  reason: string;
  kickabout: boolean;
  done: DoneRecord | null;
  doneInVersion: number | null;
  changedIn: number | null;
}

/* Where a plan parameter came from: the answers, or the chat change that made a version. */
export type Source = "answers" | { version: number };

export interface PlanParams {
  sport: string;
  L: number;
  M: number;
  slot: string;
  withOthers: boolean;
  D: number;
  source: Record<"L" | "M" | "slot" | "sport" | "days", Source>;
}

export interface Version {
  n: number;
  label: string;
  at: Date | null;
  params: PlanParams;
  sessions: Session[];
}

export interface Plan {
  start: Date;
  todayOffset: number;
  sample: boolean;
  active: number;
  viewing: null;
  answers: Answers;
  versions: Version[];
}

export interface ChangeRow {
  offset: number;
  day: string;
  date: string;
  was: string;
  now: string;
}

export type PipelineResult =
  | { ok: false; intent: string; text: string }
  | { ok: true; intent: string; label: string; explanation: string; rows: ChangeRow[]; foot: string; n: number; version: Version };

export interface LastFeeling {
  feeling: string;
  offset: number;
}

export interface Chip {
  id: string;
  label: string;
  text: string;
  accent?: boolean;
}

export interface ResultSummary {
  n: number;
  rows: ChangeRow[];
  foot: string;
}

export type ChatItem =
  | { id: string; fresh?: boolean; kind: "user" | "coach" | "refusal"; text: string }
  | { id: string; fresh?: boolean; kind: "checking" }
  | { id: string; fresh?: boolean; kind: "result"; res: ResultSummary; undone?: boolean }
  | { id: string; fresh?: boolean; kind: "closing"; kept: boolean };

export interface UiState {
  selectedOffset: number;
  dialog: { offset: number; mode: "session" | "feedback" } | null;
  chatOpen: boolean;
}

export type Breakpoint = "phone" | "tablet" | "desktop";

/* A chat item before it gets its id (and `fresh` flag) in App's push(). */
export type NewChatItem = ChatItem extends infer T ? (T extends ChatItem ? Omit<T, "id"> & { id?: string } : never) : never;
