import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import type { Account, AuthSession } from '@/api/types';

/** The signed-in account and its time zone (Settings 9.6). */
export function useAccount() {
  return useQuery({ queryKey: queryKeys.account, queryFn: () => api.account.get() });
}

/**
 * Settings › Account › Name: changes the name the person is greeted by. Today
 * and the You tab show it at once; the session and account are then read again.
 */
export function useUpdateName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.account.updateName(name),
    onSuccess: (name) => {
      queryClient.setQueryData<Account>(queryKeys.account, (account) =>
        account ? { ...account, user: { ...account.user, name } } : account,
      );
      queryClient.setQueryData<AuthSession | null>(queryKeys.session, (session) =>
        session ? { ...session, user: { ...session.user, name } } : session,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.account });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}
