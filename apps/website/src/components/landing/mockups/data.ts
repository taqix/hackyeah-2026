/* Fixed content for the phone mockups: a picture of Ana's first week, not live demo state.
   Drawn from design/prototype — Home 5, onboarding 2 and chat 8.3. */

import type { ChangeCardProps } from "../../common";

export interface MockDay {
  initial: string;
  date: number;
  state?: "done" | "planned";
  today?: boolean;
}

export const MOCK_WEEK: MockDay[] = [
  { initial: "M", date: 5, state: "done" },
  { initial: "T", date: 6 },
  { initial: "W", date: 7, state: "planned", today: true },
  { initial: "T", date: 8 },
  { initial: "F", date: 9, state: "planned" },
  { initial: "S", date: 10 },
  { initial: "S", date: 11 },
];

export interface MockSessionRow {
  day: string;
  date: string;
  title: string;
  meta: string;
  end?: "done" | "today";
}

export const MOCK_SESSIONS: MockSessionRow[] = [
  { day: "Mon", date: "5 Oct", title: "Brisk walk", meta: "20 min · felt easy", end: "done" },
  { day: "Wed", date: "7 Oct", title: "Walk-run intervals", meta: "7:00 · 20 min", end: "today" },
  { day: "Fri", date: "9 Oct", title: "Walk-run intervals", meta: "18:00 · 20 min" },
];

export const MOCK_CHANGE: Pick<ChangeCardProps, "summary" | "rows" | "kept"> = {
  summary: "All your sessions are at 7:00 now, and Friday is 10 minutes.",
  rows: [
    {
      day: "Fri",
      date: "9 Oct",
      title: "Walk-run intervals",
      note: "Three runs instead of six.",
      diffs: [
        { icon: "clock", from: "18:00", to: "7:00" },
        { icon: "timer", from: "20 min", to: "10 min" },
      ],
    },
  ],
  kept: "Monday to Wednesday stay as you did them.",
};

export const MOCK_STEPS_TODAY = "3,240";
