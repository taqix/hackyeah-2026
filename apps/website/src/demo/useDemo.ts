/* The demo as the views see it: its state, the few values derived from it, and one named
   action per thing the reader can do. Nothing here holds state of its own — the reducer
   owns all of it, so the chat's answer never has to be read back through a ref. */

import { useMemo, useReducer } from "react";
import {
  buildPlan, buildSamplePlan, cloneAnswers, rankSports, startOfDay, SAMPLE_ANSWERS, SAMPLE_PLAN_SPORT,
  type Answers, type CompanyKey, type PlaceKey, type RankedSport, type SessionFeedback, type SportKey,
} from "../domain";
import { prefersReducedMotion } from "../hooks/useMediaQuery";
import * as route from "../routing";
import { demoReducer, INITIAL_STATE, type DemoState } from "./reducer";

/** How long "Checking the change…" shows. It stands in for a request to the real API,
    and is shortened when the reader has asked for less motion. */
const CHECKING_MS = 700;
const CHECKING_MS_REDUCED = 300;

export interface DemoActions {
  answer(patch: Partial<Answers>): void;
  togglePlace(key: PlaceKey): void;
  toggleCompany(key: CompanyKey): void;
  pickSport(sport: SportKey): void;
  visitStep(step: number): void;
  /** Accept the suggested sport and build the first plan. */
  chooseSport(): void;
  planningFinished(): void;
  /** Open the seeded guest plan at #/try/sample. */
  openSample(): void;
  startOver(): void;
  selectDay(offset: number): void;
  openSession(offset: number): void;
  closeDialog(): void;
  askHowItFelt(): void;
  toggleExercise(index: number): void;
  saveFeedback(feedback: SessionFeedback): void;
  openChat(): void;
  closeChat(): void;
  send(text: string): void;
  undo(version: number): void;
}

export interface Demo {
  state: DemoState;
  /** Every sport, best fit first, for the current answers. */
  ranked: RankedSport[];
  /** The sport the plan would use: the reader's pick while it is still on offer, else the best fit. */
  sport: SportKey;
  actions: DemoActions;
}

export function useDemo(): Demo {
  const [state, dispatch] = useReducer(demoReducer, INITIAL_STATE);

  const ranked = useMemo(() => rankSports(state.answers), [state.answers]);
  const pick = state.sportPick;
  const sport = pick && ranked.some(candidate => candidate.key === pick) ? pick : ranked[0].key;

  const actions: DemoActions = {
    answer: patch => dispatch({ type: "answered", patch }),
    togglePlace: key => dispatch({ type: "toggledPlace", key }),
    toggleCompany: key => dispatch({ type: "toggledCompany", key }),
    pickSport: chosen => dispatch({ type: "pickedSport", sport: chosen }),
    visitStep: step => dispatch({ type: "visitedStep", step }),

    chooseSport: () => {
      const now = new Date();
      const plan = buildPlan({ answers: state.answers, sport, today: startOfDay(now), now });
      dispatch({ type: "planningStarted", plan, sport });
      route.navigate(route.PLANNING);
    },
    planningFinished: () => {
      dispatch({ type: "planningFinished" });
      route.redirect(route.PLAN);
    },
    openSample: () => {
      const now = new Date();
      const answers = cloneAnswers(SAMPLE_ANSWERS);
      dispatch({
        type: "sampleOpened",
        plan: buildSamplePlan(startOfDay(now), now, answers),
        answers,
        sport: SAMPLE_PLAN_SPORT,
        lastStep: route.LAST_STEP,
      });
      route.redirect(route.PLAN);
    },
    startOver: () => {
      dispatch({ type: "startedOver" });
      const start = route.stepPath(route.FIRST_STEP);
      /* Already on the first question: re-announce it so the view resets and refocuses. */
      if (location.hash === start) route.renavigate();
      else route.navigate(start);
    },

    selectDay: offset => dispatch({ type: "selectedDay", offset }),
    openSession: offset => dispatch({ type: "openedSession", offset }),
    closeDialog: () => dispatch({ type: "closedDialog" }),
    askHowItFelt: () => dispatch({ type: "askedHowItFelt" }),
    toggleExercise: index => dispatch({ type: "toggledExercise", index }),
    saveFeedback: feedback => dispatch({ type: "savedFeedback", feedback }),

    openChat: () => dispatch({ type: "openedChat" }),
    closeChat: () => dispatch({ type: "closedChat" }),
    send: text => {
      if (state.busy) return;
      dispatch({ type: "sentMessage", text });
      const delay = prefersReducedMotion() ? CHECKING_MS_REDUCED : CHECKING_MS;
      setTimeout(() => dispatch({ type: "messageResolved", text, now: new Date() }), delay);
    },
    undo: version => dispatch({ type: "undid", version }),
  };

  return { state, ranked, sport, actions };
}
