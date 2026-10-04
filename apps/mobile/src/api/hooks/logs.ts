import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import type { ActivityLog, CreateLogInput, SaveFeedbackInput, UpdateLogInput } from '@/api/types';

/** A log changes the plan's weeks and sessions, the summary and the feedback overview. */
function logChanged(queryClient: QueryClient, log: ActivityLog) {
  queryClient.setQueryData(queryKeys.log(log.id), log);
  void queryClient.invalidateQueries({ queryKey: queryKeys.planAll });
  void queryClient.invalidateQueries({ queryKey: queryKeys.lastExerciseAll });
  void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
  void queryClient.invalidateQueries({ queryKey: queryKeys.feedback });
}

/** Log a session (6.1, 6.8) or an extra (`session_id: null`); the session becomes done. */
export function useCreateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLogInput) => api.logs.create(input),
    onSuccess: (log) => logChanged(queryClient, log),
  });
}

/** One log (feedback 7, What you did 6.8, editing an extra). */
export function useLog(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.log(id ?? ''),
    queryFn: () => api.logs.get(id as string),
    enabled: !!id,
  });
}

/** Change a saved log (Edit on a workout card opens the form filled in). */
export function useUpdateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateLogInput }) => api.logs.update(id, patch),
    onSuccess: (log) => logChanged(queryClient, log),
  });
}

/** Completion & feedback (7): how it felt, a note, and "Would you choose this again?". */
export function useSaveFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ logId, feedback }: { logId: string; feedback: SaveFeedbackInput }) =>
      api.logs.saveFeedback(logId, feedback),
    onSuccess: (log) => logChanged(queryClient, log),
  });
}

/** "Last time, Mon 12 Oct: 3 × 10 · 8 kg" for a gym exercise, or null with no history. */
export function useLastExercise(exercise: { exercise_id?: string; name: string } | null | undefined) {
  const key = exercise ? (exercise.exercise_id ?? exercise.name) : '';
  return useQuery({
    queryKey: queryKeys.lastExercise(key),
    queryFn: () => api.logs.lastForExercise(exercise as { exercise_id?: string; name: string }),
    enabled: !!exercise,
  });
}
