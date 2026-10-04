/* What a session is made of, and the contract every sport's builder implements. */

/** One line of a session: what to do, how much, and a hint. */
export interface SessionExercise {
  name: string;
  detail: string;
  meta: string;
  /** This line's share of the session, in seconds. */
  seconds: number;
}

/** A session's content, before it is placed on a day. */
export interface SessionBlueprint {
  title: string;
  exercises: SessionExercise[];
}

export interface SessionBuildInput {
  /** 0-based position in the week. The first session is gentler; later ones vary. */
  index: number;
  /** 0–2 difficulty, from the starting-point answer or a chat change. */
  level: number;
  minutes: number;
  /** Football only: play with others instead of solo drills. */
  kickabout: boolean;
}

/** Everything the plan needs to know about one sport's sessions.
    A new sport implements this and is registered once; nothing else changes. */
export interface SportSessionBuilder {
  build(input: SessionBuildInput): SessionBlueprint;
  /** How the level reads in the plan's "why this plan" list: "8 reps a set". */
  describeLevel(level: number, minutes: number): string;
  /** The part that visibly changes when the level moves, for a change card: "8 reps". */
  describeLevelValue(level: number): string;
}
