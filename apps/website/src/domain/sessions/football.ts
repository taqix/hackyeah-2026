/* Football sessions: ball drills on your own, or a walking kickabout with others. */

import { formatSeconds } from "../text";
import { drillSession, drillVariant, exercise, lengthBand, roundsFor } from "./shared";
import type { DrillSet } from "./shared";
import type { SessionBlueprint, SessionBuildInput, SportSessionBuilder } from "./types";

const DRILL_SECONDS = [30, 45, 60];
const PASSES = [6, 8, 10];
const WARM_UP_SECONDS = [60, 120, 240];
const COOL_DOWN_SECONDS = [60, 120, 180];

function drillSets(level: number, minutes: number): DrillSet[] {
  const rounds = roundsFor(minutes);
  const timed = `${rounds} × ${formatSeconds(DRILL_SECONDS[level])}`;
  const eachFoot = `${rounds} × ${PASSES[level]} each foot`;
  return [
    { title: "First touches", exercises: [
      { name: "Toe taps", detail: timed, meta: "sole on the ball, swap feet" },
      { name: "Inside-foot passes", detail: eachFoot, meta: "against a wall" },
    ] },
    { title: "Wall passing", exercises: [
      { name: "Wall passes", detail: eachFoot, meta: "a step back each round" },
      { name: "Stop the ball", detail: `${rounds} × ${PASSES[level]}`, meta: "sole trap" },
    ] },
    { title: "Dribble and walk", exercises: [
      { name: "Easy dribble", detail: timed, meta: "walking pace, small touches" },
      { name: "Toe taps", detail: timed, meta: "sole on the ball" },
    ] },
  ];
}

/** Playing with others: passing, then walking football. Split in whole minutes, as it is played. */
function kickaboutSession(minutes: number, warmUpSeconds: number, coolDownSeconds: number): SessionBlueprint {
  const playMinutes = (minutes * 60 - warmUpSeconds - coolDownSeconds) / 60;
  const passingMinutes = Math.ceil(playMinutes / 2);
  const gameMinutes = playMinutes - passingMinutes;
  return {
    title: "Kickabout with others",
    exercises: [
      exercise("Brisk walk", formatSeconds(warmUpSeconds), "warm-up", warmUpSeconds),
      exercise("Pass back and forth", `${passingMinutes} min`, "about 10 m apart", passingMinutes * 60),
      exercise("Walking football", `${gameMinutes} min`, "no running, just play", gameMinutes * 60),
      exercise("Slow walk", formatSeconds(coolDownSeconds), "cool-down", coolDownSeconds),
    ],
  };
}

export const footballSessions: SportSessionBuilder = {
  build({ index, level, minutes, kickabout }: SessionBuildInput): SessionBlueprint {
    const band = lengthBand(minutes);
    const warmUpSeconds = WARM_UP_SECONDS[band];
    const coolDownSeconds = COOL_DOWN_SECONDS[band];
    if (kickabout) return kickaboutSession(minutes, warmUpSeconds, coolDownSeconds);
    return drillSession(
      drillSets(level, minutes)[drillVariant(index)],
      minutes,
      exercise("Brisk walk", formatSeconds(warmUpSeconds), "warm-up", warmUpSeconds),
      exercise("Slow walk", formatSeconds(coolDownSeconds), "cool-down", coolDownSeconds),
    );
  },
  describeLevel(level) {
    return `${formatSeconds(DRILL_SECONDS[level])} drills`;
  },
  describeLevelValue(level) {
    return `${formatSeconds(DRILL_SECONDS[level])} drills`;
  },
};
