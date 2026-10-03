/* Which routes the demo's state allows. A reader who opens a link into the middle of the
   journey is sent to the first thing they still have to do. */

import * as route from "../routing";
import type { Route } from "../routing";
import type { DemoState } from "./reducer";

/** The first question still unanswered, of the two that gate the rest. */
function firstUnanswered(state: DemoState): number | null {
  if (!state.answers.comfort) return 1;
  if (!state.answers.places.length) return 2;
  return null;
}

/** Where to send the reader instead of the route they asked for, or null to stay. */
export function redirectFor(current: Route, state: DemoState): string | null {
  if (current.view === "step") {
    const unanswered = firstUnanswered(state);
    const askedFor = current.step ?? route.FIRST_STEP;
    return unanswered && askedFor > unanswered ? route.stepPath(unanswered) : null;
  }
  /* The planning moment only exists while it is playing; it cannot be returned to. */
  if (current.view === "planning" && !state.planning) {
    return state.plan ? route.PLAN : route.stepPath(route.FIRST_STEP);
  }
  if (current.view === "plan" && !state.plan) return route.stepPath(route.FIRST_STEP);
  return null;
}
