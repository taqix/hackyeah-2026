/**
 * Data hooks for screens: the only way UI reads or changes server data.
 * Queries share `queryKeys`, so each mutation invalidates exactly what it
 * changed: logs → plan, summary and feedback; chat → chat and plan; answers →
 * preferences, plan and summary.
 */
export { useAccount, useUpdateName } from './account';
export {
  useAuthProviders,
  useLookupEmail,
  useSendPasswordReset,
  useSession,
  useSignInWithEmail,
  useSignInWithGoogle,
  useSignOut,
  useSignUpWithEmail,
  useUpdatePassword,
} from './auth';
export { useSports, useSport } from './catalog';
export { useChatMessages, useSendChatMessage, useUndoChatMessage, type SendChatMessageInput } from './chat';
export { useCommitLog, useCreateLog, useLastExercise, useLog, useSaveFeedback, useUpdateLog } from './logs';
export {
  useBuildPlan,
  useDismissRecentChange,
  useEnsureNextWeek,
  usePlannedSession,
  usePlanState,
  usePlanVersions,
  useSessionsInRange,
  useWeek,
} from './plan';
export { usePreferences, useSavePreferences } from './preferences';
export {
  useAssistantSummary,
  useFeedbackOverview,
  useResetFeedback,
  useSetOpinion,
  useSetSportExcluded,
} from './profile';
