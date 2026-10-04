import { useRef, useState } from 'react';

import { useSendChatMessage } from '@/api/hooks';
import { type ChatMessage, isApiError } from '@/api/types';
import { newRequestId } from '@/lib/ids';

import type { ProblemKind } from './cards';

/**
 * The message being sent, shown at the end of the thread before the stored
 * turn arrives: sending (8.2, Updating card), sent (waiting for the refetched
 * thread), or a problem that keeps the message for Try again / Edit message.
 */
export type PendingMessage = {
  text: string;
  aboutId: string | null;
  status: 'sending' | 'sent' | ProblemKind;
  /** The stored user message's id once the turn is saved. */
  sentId: string | null;
  /** This send's request_id (one per user action). */
  requestId: string;
  /**
   * After offline or a timeout the server may already have the message, so
   * Try again resends the same request_id and it is answered, not run twice.
   */
  resend: boolean;
};

function problemKind(error: unknown): ProblemKind {
  if (isApiError(error, 'offline')) return 'offline';
  if (isApiError(error, 'stale_version')) return 'stale';
  if (isApiError(error, 'ai_unavailable')) return 'unavailable';
  return 'failed';
}

const isTransport = (error: unknown) => isApiError(error, 'offline') || isApiError(error, 'timeout');

/**
 * One request at a time. Nothing half-applies: failure, offline and stale keep
 * the message here, Try again resends it (a stale one after refreshing the
 * plan, so it builds on the latest version) and Edit message hands it back.
 * Nothing retries by itself.
 */
export function useChatSend({
  messages,
  refetchMessages,
  refreshPlan,
}: {
  messages: ChatMessage[] | undefined;
  refetchMessages: () => Promise<unknown>;
  refreshPlan: () => Promise<unknown>;
}) {
  const send = useSendChatMessage();
  const [pending, setPending] = useState<PendingMessage | null>(null);
  // Guards a second tap before the re-render locks the box.
  const inFlight = useRef(false);

  const arrived = pending?.status === 'sent' && !!messages?.some((m) => m.id === pending.sentId);
  const visible = pending && !arrived ? pending : null;
  const busy = visible?.status === 'sending' || visible?.status === 'sent';

  const submit = (
    rawText: string,
    aboutId: string | null,
    options?: { refreshFirst?: boolean; requestId?: string },
  ) => {
    const text = rawText.trim();
    if (!text || busy || inFlight.current) return false;
    inFlight.current = true;
    const requestId = options?.requestId ?? newRequestId();
    const message = { text, aboutId, requestId, sentId: null, resend: false };
    setPending({ ...message, status: 'sending' });

    const run = () =>
      send.mutate(
        { text, about_session_id: aboutId, request_id: requestId },
        {
          onSuccess: (turn) => {
            const sentId = turn.messages[0]?.id ?? null;
            setPending(sentId ? { ...message, status: 'sent', sentId } : null);
            // Clear once the refetched thread is in, even if that refetch fails.
            void refetchMessages().finally(() => {
              inFlight.current = false;
              setPending((current) => (current && current.sentId === sentId ? null : current));
            });
          },
          onError: (error) => {
            inFlight.current = false;
            setPending({ ...message, status: problemKind(error), resend: isTransport(error) });
          },
        },
      );

    if (options?.refreshFirst) void refreshPlan().finally(run);
    else run();
    return true;
  };

  /**
   * Try again: resend the same text with the same attachment. The same
   * request_id after a transport failure; a new one otherwise (a stale one
   * builds on the refreshed plan).
   */
  const retry = () => {
    if (!visible || busy) return;
    submit(visible.text, visible.aboutId, {
      refreshFirst: visible.status === 'stale',
      requestId: visible.resend ? visible.requestId : undefined,
    });
  };

  /** Edit message: take the waiting message out of the thread and return it for the box. */
  const takeBack = (): PendingMessage | null => {
    if (!visible || busy) return null;
    setPending(null);
    return visible;
  };

  return { pending: visible, busy, submit, retry, takeBack };
}
