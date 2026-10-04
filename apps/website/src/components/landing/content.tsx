/* The landing page's copy. The beats keep their mockup beside them, so the two cannot
   drift out of order. */

import type { ComponentType } from "react";
import { MockAsk, MockChange, MockPlan } from "./mockups";

export interface Notice {
  icon: string;
  text: string;
}

/** What the page wants a first-time reader to notice, under the hero. */
export const NOTICES: Notice[] = [
  { icon: "info", text: "Every session says what to do" },
  { icon: "shield-check", text: "The plan checked before it's saved" },
  { icon: "history", text: "Changes keep the sessions you've done" },
  { icon: "lock", text: "A request it declines, with the plan left as it was" },
];

export interface Beat {
  kicker: string;
  title: string;
  body: string;
  icon: string;
  /** The app screen this beat is about. */
  mockup: ComponentType;
}

/** Ask, plan, change: the three beats of the journey. */
export const BEATS: Beat[] = [
  {
    kicker: "1 · Ask",
    title: "Calm questions",
    body: "How starting feels, where you can move, and how much time you have. No wrong answers.",
    icon: "list-checks",
    mockup: MockAsk,
  },
  {
    kicker: "2 · Plan",
    title: "A sensible week",
    body: "A sport that fits, then short sessions with rest days between. Each one says what to do.",
    icon: "calendar-days",
    mockup: MockPlan,
  },
  {
    kicker: "3 · Change",
    title: "Moved, not failed.",
    body: "Say what doesn't work. The plan changes straight away, explains the change, and keeps what you've done.",
    icon: "message-circle",
    mockup: MockChange,
  },
];

export interface Feature {
  icon: string;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  { icon: "list-checks", title: "A few calm questions", body: "How starting feels, what you'd like to try, where you can move, and how much time you have." },
  { icon: "calendar-days", title: "A week that fits", body: "Sessions land in your free time, at the times you prefer, with rest days between." },
  { icon: "timer", title: "Guided sessions", body: "Intervals, sets and holds are counted for you. Log a run, a set or a swim as you go." },
  { icon: "smile", title: "How did it feel?", body: "One tap after each session, from “could have kept going” to “had to stop early”. Add a note if you like." },
  { icon: "message-circle", title: "Change it by asking", body: "Say what doesn't work. The plan updates straight away, explains the change, and you can undo it." },
  { icon: "feather", title: "Not today? That's fine", body: "Make it simpler, do five minutes, move it, or skip it with nothing to make up." },
  { icon: "footprints", title: "Steps from your phone", body: "Today's count sits on Home. It stays on your phone." },
  { icon: "shield-check", title: "Private by default", body: "Movo reads only when you're busy, never what's in your calendar. Edit any answer whenever you like." },
];
