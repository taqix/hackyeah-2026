import { useRef } from "react";
import { Button, Card, Icon } from "../../design-system";
import {
  activeVersion,
  formatWeekRange,
  planSummary,
  sessionAt,
  sortByOffset,
  SPORTS,
  suggestionChips,
  type Chip,
  type LastFeeling,
  type Plan,
  type RevisionSummary,
  type SessionFeedback,
} from "../../domain";
import type { Breakpoint } from "../../hooks/useMediaQuery";
import type { ChatItem, SessionDialogState } from "../../demo/types";
import { Dialog, Kicker, PlanStrip, WeekList } from "../common";
import { Chat } from "./Chat";
import { DayCard } from "./DayCard";
import { SessionDialog } from "./SessionDialog";
import { WhyThisPlan } from "./WhyThisPlan";

export interface PlanViewProps {
  plan: Plan;
  chat: ChatItem[];
  busy: boolean;
  lastFeeling: LastFeeling | null;
  status: string;
  selectedOffset: number;
  dialog: SessionDialogState | null;
  chatOpen: boolean;
  /** One flag per exercise of the open session dialog, ticked off live. */
  ticked: boolean[];
  breakpoint: Breakpoint;
  onSelectDay(offset: number): void;
  onOpenSession(offset: number): void;
  onCloseDialog(): void;
  /** Switches the session dialog to the "how did it feel?" form. */
  onAskHowItFelt(): void;
  onToggleExercise(index: number): void;
  onSaveFeedback(feedback: SessionFeedback): void;
  onOpenChat(): void;
  onCloseChat(): void;
  onSend(text: string): void;
  onUndo(version: number): void;
  onStartOver(): void;
}

/** The plan view: the week, the selected day, why it looks this way, and the chat that changes it. */
export function PlanView({
  plan,
  chat,
  busy,
  lastFeeling,
  status,
  selectedOffset,
  dialog,
  chatOpen,
  ticked,
  breakpoint,
  onSelectDay,
  onOpenSession,
  onCloseDialog,
  onAskHowItFelt,
  onToggleExercise,
  onSaveFeedback,
  onOpenChat,
  onCloseChat,
  onSend,
  onUndo,
  onStartOver,
}: PlanViewProps) {
  const version = activeVersion(plan);
  const selectedSession = sessionAt(version, selectedOffset);
  const chips: Chip[] = suggestionChips(plan, lastFeeling);

  /* "See plan" can jump to a row a plan change just added or changed, which may not be the
     row that opened the chat sheet — so a ref tells the dialog's close handler where focus
     should land instead, set just before the chat closes, then cleared once it is read. */
  const focusAfterRef = useRef<string | null>(null);

  function handleSeePlan(summary: RevisionSummary) {
    const changedSession = sortByOffset(version.sessions).find(session => session.changedIn === version.number);
    focusAfterRef.current = changedSession ? `s-row-${changedSession.offset}` : `s-strip-${summary.rows[0]?.offset ?? selectedOffset}`;
    onCloseChat();
  }

  const chatProps = { plan, chat, busy, chips, onSend, onUndo, onStartOver, breakpoint, onSeePlan: handleSeePlan };

  return (
    <div className="s-wrap">
      <div className="s-plan">
        <div className="s-plan-left s-enter">
          <div className="s-planhead">
            <Kicker>Your first week · {formatWeekRange(plan.start)}</Kicker>
            <h1 className="s-h1" tabIndex={-1} data-page-title="">{SPORTS[version.params.sport].heading}</h1>
            <p className="s-body">{planSummary(plan)}</p>
            <p className="s-status" role="status" aria-live="polite">
              {status ? <><Icon name="circle-check" size={16} />{status}</> : null}
            </p>
          </div>
          <PlanStrip plan={plan} selected={selectedOffset} onSelect={onSelectDay} />
          <div key={`${selectedOffset}-${version.number}-${selectedSession?.done ? "d" : "p"}`} className="s-xfade">
            <DayCard plan={plan} selectedOffset={selectedOffset} onOpen={onOpenSession} />
          </div>
          <section className="s-col" style={{ gap: 8 }} aria-labelledby="s-week-h">
            <h2 id="s-week-h" className="s-sect">This week</h2>
            <WeekList plan={plan} onOpen={onOpenSession} flashKey={version.number} />
          </section>
          <WhyThisPlan plan={plan} />
        </div>
        {breakpoint === "desktop" ? (
          <div className="s-chatgrow">
            <Card padding={20} style={{ minHeight: 480, display: "flex", flexDirection: "column" }}>
              <Chat {...chatProps} />
            </Card>
          </div>
        ) : null}
      </div>
      {breakpoint !== "desktop" ? (
        <>
          <div className="s-bottombar">
            <div><Button size="lg" fullWidth icon="message-circle" onClick={onOpenChat}>Change plan</Button></div>
          </div>
          <Dialog open={chatOpen} className="s-chatsheet" labelledBy="s-chat-h" focusAfter={focusAfterRef} onClose={onCloseChat}>
            <div className="s-dlg-in">
              <Chat {...chatProps} inDialog onClose={onCloseChat} />
            </div>
          </Dialog>
        </>
      ) : null}
      <Dialog open={!!dialog} labelledBy="s-dlg-h" onClose={onCloseDialog} fallbackFocus={dialog ? `s-row-${dialog.offset}` : null}>
        {dialog ? (
          <SessionDialog
            plan={plan}
            dialogState={dialog}
            ticked={ticked}
            onToggleExercise={onToggleExercise}
            onAskHowItFelt={onAskHowItFelt}
            onSaveFeedback={onSaveFeedback}
            onClose={onCloseDialog}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
