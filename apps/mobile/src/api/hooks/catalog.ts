import { useQuery } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';

/** The sport catalog (working and preview sports). Rarely changes, so it stays cached. */
export function useSports() {
  return useQuery({ queryKey: queryKeys.sports, queryFn: () => api.catalog.listSports(), staleTime: Infinity });
}

/** One catalog sport by ID, or null when the catalog has no such sport. */
export function useSport(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.sports,
    queryFn: () => api.catalog.listSports(),
    staleTime: Infinity,
    select: (sports) => sports.find((s) => s.id === id) ?? null,
  });
}
