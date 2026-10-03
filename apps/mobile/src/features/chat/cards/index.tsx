/**
 * Chat cards: everything drawn inside the thread (design/prototype/chat.jsx).
 *
 * The chat screen (src/features/chat/screen) renders these. Keep the exported
 * names and props stable: both sides code against them. Presentational only;
 * the one query here is the sport catalog, for names and metrics.
 */
import type { ChatMessage } from '@/api/types';

import { CoachReply, UserMessage } from './bubbles';
import { ChangeCard } from './change-card';
import { LogCard } from './log-card';

export { DayBreak, ProblemCard, type ProblemCardProps, type ProblemKind, UpdatingCard } from './status-cards';

export type ChatMessageViewProps = {
  message: ChatMessage;
  /** The newest coach message: only it keeps live quick replies and the quiet option. */
  isLatest: boolean;
  /** A request is running (one change at a time): quick replies and Undo are disabled. */
  busy: boolean;
  /** Earlier days' change cards render folded (8.8): summary only, tap to expand. */
  folded?: boolean;
  /** Sends the text at once (quick replies and the quiet option). */
  onQuickReply: (text: string) => void;
  /** Undo on a change card or a logged workout card. */
  onUndo: (messageId: string) => void;
  /** "See week" on a change card: opens Today on the changed week. */
  onSeeWeek: (date: string) => void;
  /** "Edit" on a logged workout card: opens the log-it form filled in. */
  onEditLog: (logId: string) => void;
};

/** One message: user bubble, coach reply, change card or logged-workout card. */
export function ChatMessageView({
  message,
  isLatest,
  busy,
  folded = false,
  onQuickReply,
  onUndo,
  onSeeWeek,
  onEditLog,
}: ChatMessageViewProps) {
  switch (message.kind) {
    case 'text':
      return <UserMessage message={message} />;
    case 'reply':
      return <CoachReply message={message} isLatest={isLatest} busy={busy} onQuickReply={onQuickReply} />;
    case 'change':
      return <ChangeCard message={message} busy={busy} folded={folded} onUndo={onUndo} onSeeWeek={onSeeWeek} />;
    case 'workout_logged':
      return <LogCard message={message} busy={busy} onUndo={onUndo} onEditLog={onEditLog} />;
  }
}
