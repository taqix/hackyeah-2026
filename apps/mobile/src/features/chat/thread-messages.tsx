import { Fragment } from 'react';

import type { ChatMessage, LocalDate } from '@/api/types';
import { toLocalDate } from '@/lib/dates';

import { ChatMessageView, DayBreak, ProblemCard, UpdatingCard } from './cards';
import { dayBreakLabel, messageDay } from './labels';
import type { PendingMessage } from './use-chat-send';

export type ThreadMessagesProps = {
  messages: ChatMessage[];
  /** The message being sent, drawn as a user bubble after the stored ones. */
  pending: PendingMessage | null;
  pendingMessage: ChatMessage | null;
  today: Date;
  busy: boolean;
  onQuickReply: (text: string) => void;
  onUndo: (messageId: string) => void;
  onSeeWeek: (date: string) => void;
  onEditLog: (logId: string) => void;
  onRetry: () => void;
  onEdit: () => void;
};

/**
 * The stored conversation, oldest first, with a day break whenever the day
 * changes (only once the thread spans more than today). Change cards from
 * earlier days fold (8.8); only the newest coach message keeps live replies.
 */
export function ThreadMessages({
  messages,
  pending,
  pendingMessage,
  today,
  busy,
  onQuickReply,
  onUndo,
  onSeeWeek,
  onEditLog,
  onRetry,
  onEdit,
}: ThreadMessagesProps) {
  const todayDate = toLocalDate(today);
  const showBreaks = messages.some((m) => messageDay(m) !== todayDate);
  const latestCoachId = [...messages].reverse().find((m) => m.role === 'coach')?.id ?? null;

  // A break before the first message of each day; the pending message is today's.
  const days = messages.map(messageDay);
  const breakAt = (index: number, day: LocalDate) => showBreaks && (index === 0 || days[index - 1] !== day);
  const lastDay = days.length ? days[days.length - 1] : null;

  return (
    <>
      {messages.map((message, index) => {
        const day = days[index];
        return (
          <Fragment key={message.id}>
            {breakAt(index, day) ? <DayBreak label={dayBreakLabel(day, today)} /> : null}
            <ChatMessageView
              message={message}
              isLatest={message.id === latestCoachId}
              busy={busy}
              folded={message.kind === 'change' && day < todayDate}
              onQuickReply={onQuickReply}
              onUndo={onUndo}
              onSeeWeek={onSeeWeek}
              onEditLog={onEditLog}
            />
          </Fragment>
        );
      })}
      {pending && pendingMessage ? (
        <>
          {showBreaks && lastDay !== todayDate ? <DayBreak label={dayBreakLabel(todayDate, today)} /> : null}
          <ChatMessageView
            message={pendingMessage}
            isLatest={false}
            busy
            onQuickReply={onQuickReply}
            onUndo={onUndo}
            onSeeWeek={onSeeWeek}
            onEditLog={onEditLog}
          />
          {pending.status === 'sending' || pending.status === 'sent' ? (
            <UpdatingCard />
          ) : (
            <ProblemCard kind={pending.status} onRetry={onRetry} onEdit={onEdit} />
          )}
        </>
      ) : null}
    </>
  );
}
