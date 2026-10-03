import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import { isApiError, type PlanState, type SendChatInput } from '@/api/types';

function chatChanged(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.chat });
  void queryClient.invalidateQueries({ queryKey: queryKeys.planAll });
}

/** The whole conversation, oldest first. */
export function useChatMessages() {
  return useQuery({ queryKey: queryKeys.chat, queryFn: () => api.chat.listMessages() });
}

export type SendChatMessageInput = Omit<SendChatInput, 'base_version'> & {
  /** Defaults to the cached plan state's active version. */
  base_version?: number | null;
};

/**
 * Send a message. A valid change is applied before this resolves. Rejects with
 * generation_failed (8.12), stale_version (8.13) or offline (8.14); nothing is
 * stored then, so Try again resends the same text. For Home's Move it (8.15)
 * send "Move it" with the missed session as `about_session_id`.
 */
export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendChatMessageInput) =>
      api.chat.send({
        text: input.text,
        about_session_id: input.about_session_id,
        request_id: input.request_id,
        base_version:
          input.base_version !== undefined
            ? input.base_version
            : (queryClient.getQueryData<PlanState>(queryKeys.planState)?.active_version ?? null),
      }),
    onSuccess: () => chatChanged(queryClient),
    onError: (error) => {
      // Try again must build on the latest plan.
      if (isApiError(error, 'stale_version')) void queryClient.invalidateQueries({ queryKey: queryKeys.planAll });
    },
  });
}

/** Undo a change card (the previous plan comes back as a new version) or remove an added workout. */
export function useUndoChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => api.chat.undo(messageId),
    onSuccess: () => chatChanged(queryClient),
  });
}
