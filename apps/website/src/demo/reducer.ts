/* Every change to the demo's state, in one pure function. The chat's answer is computed
   here too — `reviseFromMessage` is pure — so nothing has to read state through a ref. */

import {
  applyRevision, feedbackReplies, markSessionDone, openingMessages, reviseFromMessage, sessionAt,
  undoLastRevision, activeVersion, feelingOption, EMPTY_ANSWERS,
  type Answers, type CompanyKey, type LastFeeling, type Plan, type PlaceKey, type SessionFeedback,
  type SportKey,
} from "../domain";
import { FIRST_STEP } from "../routing";
import type { ChatItem, NewChatItem, SessionDialogState } from "./types";

export interface DemoState {
  answers: Answers;
  /** The sport the reader chose, when they chose one; otherwise the best fit is used. */
  sportPick: SportKey | null;
  /** The furthest question reached, so the summary panel fills in as they go. */
  visited: number;
  /** True while the planning moment is playing. */
  planning: boolean;
  plan: Plan | null;
  chat: ChatItem[];
  lastFeeling: LastFeeling | null;
  /** True while a message is being checked, which blocks sending another. */
  busy: boolean;
  /** Whether a change has been made yet; the first one gets a closing card. */
  revisedOnce: boolean;
  dialog: SessionDialogState | null;
  chatOpen: boolean;
  /** The day the plan view has selected. */
  selectedOffset: number;
  /** Which exercises are ticked off in the open session. */
  ticked: boolean[];
  /** The live region's text after an action, such as marking a session done. */
  status: string;
  nextMessageId: number;
}

/** The checking bubble is removed rather than added to, so it keeps a fixed id. */
const CHECKING_ID = "checking";

export const INITIAL_STATE: DemoState = {
  answers: EMPTY_ANSWERS,
  sportPick: null,
  visited: 0,
  planning: false,
  plan: null,
  chat: [],
  lastFeeling: null,
  busy: false,
  revisedOnce: false,
  dialog: null,
  chatOpen: false,
  selectedOffset: 0,
  ticked: [],
  status: "",
  nextMessageId: 0,
};

export type DemoAction =
  | { type: "answered"; patch: Partial<Answers> }
  | { type: "toggledPlace"; key: PlaceKey }
  | { type: "toggledCompany"; key: CompanyKey }
  | { type: "pickedSport"; sport: SportKey }
  | { type: "visitedStep"; step: number }
  | { type: "planningStarted"; plan: Plan; sport: SportKey }
  | { type: "planningFinished" }
  | { type: "sampleOpened"; plan: Plan; answers: Answers; sport: SportKey; lastStep: number }
  | { type: "startedOver" }
  | { type: "selectedDay"; offset: number }
  | { type: "openedSession"; offset: number }
  | { type: "closedDialog" }
  | { type: "askedHowItFelt" }
  | { type: "toggledExercise"; index: number }
  | { type: "savedFeedback"; feedback: SessionFeedback }
  | { type: "openedChat" }
  | { type: "closedChat" }
  | { type: "sentMessage"; text: string }
  | { type: "messageResolved"; text: string; now: Date }
  | { type: "undid"; version: number };

/** Add chat items, and retire the "new" flag from the ones already shown. */
function pushChat(state: DemoState, items: NewChatItem[]): Pick<DemoState, "chat" | "nextMessageId"> {
  let nextMessageId = state.nextMessageId;
  const added = items.map(item => ({
    id: item.id ?? `m${++nextMessageId}`,
    fresh: true,
    ...item,
  }) as ChatItem);
  const settled = state.chat.map(item => (item.fresh ? { ...item, fresh: false } : item));
  return { chat: [...settled, ...added], nextMessageId };
}

/** The state a fresh plan starts in: its opening messages, today selected, nothing open. */
function withNewPlan(state: DemoState, plan: Plan): DemoState {
  let nextMessageId = state.nextMessageId;
  const chat = openingMessages(plan).map((text): ChatItem => ({ id: `m${++nextMessageId}`, kind: "coach", text }));
  return {
    ...state,
    plan,
    chat,
    nextMessageId,
    lastFeeling: null,
    revisedOnce: false,
    busy: false,
    status: "",
    selectedOffset: plan.todayOffset,
    dialog: null,
    chatOpen: false,
  };
}

function toggle<T>(list: T[], key: T): T[] {
  return list.includes(key) ? list.filter(item => item !== key) : [...list, key];
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "answered":
      return { ...state, answers: { ...state.answers, ...action.patch } };

    case "toggledPlace":
      return { ...state, answers: { ...state.answers, places: toggle(state.answers.places, action.key) } };

    case "toggledCompany":
      return { ...state, answers: { ...state.answers, company: toggle(state.answers.company, action.key) } };

    case "pickedSport":
      return { ...state, sportPick: action.sport };

    case "visitedStep":
      return { ...state, visited: Math.max(state.visited, action.step) };

    case "planningStarted":
      return { ...withNewPlan(state, action.plan), sportPick: action.sport, planning: true };

    case "planningFinished":
      return { ...state, planning: false };

    case "sampleOpened":
      return {
        ...withNewPlan(state, action.plan),
        answers: action.answers,
        sportPick: action.sport,
        visited: action.lastStep,
      };

    case "startedOver":
      return { ...INITIAL_STATE, nextMessageId: state.nextMessageId, visited: FIRST_STEP - 1 };

    case "selectedDay":
      return { ...state, selectedOffset: action.offset };

    case "openedSession": {
      if (!state.plan) return state;
      const session = sessionAt(activeVersion(state.plan), action.offset);
      return {
        ...state,
        selectedOffset: action.offset,
        dialog: { offset: action.offset, mode: "session" },
        ticked: (session?.exercises ?? []).map(() => false),
      };
    }

    case "closedDialog":
      return { ...state, dialog: null };

    case "askedHowItFelt":
      return state.dialog ? { ...state, dialog: { ...state.dialog, mode: "feedback" } } : state;

    case "toggledExercise":
      return { ...state, ticked: state.ticked.map((done, index) => (index === action.index ? !done : done)) };

    case "savedFeedback": {
      if (!state.plan || !state.dialog) return state;
      const offset = state.dialog.offset;
      const plan = markSessionDone(state.plan, offset, action.feedback);
      const replies = feedbackReplies(plan, offset, action.feedback.feeling, state.revisedOnce)
        .map((text): NewChatItem => ({ kind: "coach", text }));
      return {
        ...state,
        ...pushChat(state, replies),
        plan,
        dialog: null,
        status: `Saved · ${feelingOption(action.feedback.feeling).phrase}.`,
        lastFeeling: { feeling: action.feedback.feeling, offset },
      };
    }

    case "openedChat":
      return { ...state, chatOpen: true };

    case "closedChat":
      return { ...state, chatOpen: false };

    case "sentMessage": {
      if (state.busy) return state;
      const items: NewChatItem[] = [{ kind: "user", text: action.text }, { kind: "checking", id: CHECKING_ID }];
      return { ...state, ...pushChat(state, items), busy: true };
    }

    case "messageResolved": {
      if (!state.plan) return state;
      const outcome = reviseFromMessage(state.plan, action.text, { lastFeeling: state.lastFeeling });
      const waiting = { ...state, chat: state.chat.filter(item => item.kind !== "checking") };
      if (!outcome.ok) {
        return { ...waiting, ...pushChat(waiting, [{ kind: "refusal", text: outcome.text }]), busy: false };
      }
      const items: NewChatItem[] = [
        { kind: "coach", text: outcome.explanation },
        { kind: "result", summary: { version: outcome.version, rows: outcome.rows, foot: outcome.foot } },
      ];
      if (!state.revisedOnce) {
        const keptAnything = state.plan.versions.some(version => version.sessions.some(session => session.done));
        items.push({ kind: "closing", kept: keptAnything });
      }
      return {
        ...waiting,
        ...pushChat(waiting, items),
        plan: applyRevision(state.plan, outcome, action.now),
        revisedOnce: true,
        busy: false,
      };
    }

    case "undid": {
      const plan = state.plan;
      /* Only the newest change can be undone, and not while a message is in flight. */
      if (state.busy || !plan || plan.active !== action.version || plan.versions.length !== action.version) return state;
      return {
        ...state,
        plan: undoLastRevision(plan),
        chat: state.chat.map(item =>
          item.kind === "result" && item.summary.version === action.version && !item.undone
            ? { ...item, undone: true }
            : item),
        status: "Change undone.",
      };
    }
  }
}

