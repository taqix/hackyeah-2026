import { activeVersion, dateAt, sessionAt, type Plan, type SessionFeedback } from "../../domain";
import type { SessionDialogState } from "../../demo/types";
import { CompletedSession } from "./CompletedSession";
import { FeedbackForm } from "./FeedbackForm";
import { OpenSession } from "./OpenSession";

export interface SessionDialogProps {
  plan: Plan;
  /** Which day's session is open, and whether it is showing the session or the feedback form. */
  dialogState: SessionDialogState;
  /** One flag per exercise, ticked off live while today's session is open. */
  ticked: boolean[];
  onToggleExercise(index: number): void;
  /** Switches the dialog from the session to the "how did it feel?" form. */
  onAskHowItFelt(): void;
  onSaveFeedback(feedback: SessionFeedback): void;
  onClose(): void;
}

/** The session dialog's body: the session, the completed session, or the feedback form. */
export function SessionDialog({ plan, dialogState, ticked, onToggleExercise, onAskHowItFelt, onSaveFeedback, onClose }: SessionDialogProps) {
  const version = activeVersion(plan);
  const session = sessionAt(version, dialogState.offset);
  if (!session) return null;
  const date = dateAt(plan, session.offset);

  if (dialogState.mode === "feedback") {
    return <FeedbackForm date={date} session={session} ticked={ticked} onSave={onSaveFeedback} onClose={onClose} />;
  }

  if (session.done) {
    return <CompletedSession date={date} session={session} done={session.done} onClose={onClose} />;
  }

  return (
    <OpenSession
      date={date}
      session={session}
      isToday={session.offset === plan.todayOffset}
      ticked={ticked}
      onToggleExercise={onToggleExercise}
      onAskHowItFelt={onAskHowItFelt}
      onClose={onClose}
    />
  );
}
