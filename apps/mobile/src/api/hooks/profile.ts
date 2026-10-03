import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import type { ChooseAgain, FeedbackOverview } from '@/api/types';

/** New feedback in the cache; the summary is rebuilt from it. */
function feedbackChanged(queryClient: QueryClient, overview: FeedbackOverview) {
  queryClient.setQueryData(queryKeys.feedback, overview);
  void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
}

/** Our assistant's description of the person (You 9, How we see you 9.2, Why 9.3). */
export function useAssistantSummary() {
  return useQuery({ queryKey: queryKeys.summary, queryFn: () => api.profile.getSummary() });
}

/** Your feedback (9.5): opinions per activity and switched-off sports. */
export function useFeedbackOverview() {
  return useQuery({ queryKey: queryKeys.feedback, queryFn: () => api.profile.getFeedback() });
}

/** Change one activity's opinion; null is Try again (back to no opinion). */
export function useSetOpinion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityKey, opinion }: { activityKey: string; opinion: ChooseAgain | null }) =>
      api.profile.setOpinion(activityKey, opinion),
    onSuccess: (overview) => feedbackChanged(queryClient, overview),
  });
}

/** Reset feedback: clears every opinion, keeps history, answers and switched-off sports. */
export function useResetFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.profile.resetFeedback(),
    onSuccess: (overview) => feedbackChanged(queryClient, overview),
  });
}

/** Switch a whole activity off (or back on with Switch on); future plans leave it out. */
export function useSetSportExcluded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sportId, excluded }: { sportId: string; excluded: boolean }) =>
      api.profile.setSportExcluded(sportId, excluded),
    onSuccess: (overview) => {
      feedbackChanged(queryClient, overview);
      void queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
      void queryClient.invalidateQueries({ queryKey: queryKeys.planAll });
    },
  });
}
