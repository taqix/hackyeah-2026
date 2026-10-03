import { useQuery } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';

/** The signed-in account and its time zone (Settings 9.6). */
export function useAccount() {
  return useQuery({ queryKey: queryKeys.account, queryFn: () => api.account.get() });
}
