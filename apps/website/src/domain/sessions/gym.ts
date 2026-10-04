/* Gym sessions: a machine warm-up and two machines, started light. */

import { formatSeconds } from "../text";
import { drillSession, drillVariant, exercise, lengthBand, roundsFor } from "./shared";
import type { SessionBlueprint, SessionBuildInput, SportSessionBuilder } from "./types";

const REPS = [8, 10, 12];
const WARM_UP_SECONDS = [120, 180, 300];
const COOL_DOWN_SECONDS = [60, 120, 180];

interface GymVisit {
  title: string;
  warmUpMachine: string;
  machines: [string, string];
}

const VISITS: GymVisit[] = [
  { title: "First gym visit", warmUpMachine: "Treadmill walk", machines: ["Leg press", "Seated row"] },
  { title: "Lower body machines", warmUpMachine: "Exercise bike", machines: ["Leg press", "Leg curl"] },
  { title: "Upper body machines", warmUpMachine: "Cross-trainer", machines: ["Chest press", "Lat pulldown"] },
];

export const gymSessions: SportSessionBuilder = {
  build({ index, level, minutes }: SessionBuildInput): SessionBlueprint {
    const band = lengthBand(minutes);
    const visit = VISITS[drillVariant(index)];
    const sets = `${roundsFor(minutes)} × ${REPS[level]}`;
    return drillSession(
      { title: visit.title, exercises: visit.machines.map(name => ({ name, detail: sets, meta: "start light" })) },
      minutes,
      exercise(visit.warmUpMachine, formatSeconds(WARM_UP_SECONDS[band]), "warm-up", WARM_UP_SECONDS[band]),
      exercise("Walk and stretch", formatSeconds(COOL_DOWN_SECONDS[band]), "cool-down", COOL_DOWN_SECONDS[band]),
    );
  },
  describeLevel(level) {
    return `${REPS[level]} reps a set, starting light`;
  },
  describeLevelValue(level) {
    return `${REPS[level]} reps`;
  },
};
