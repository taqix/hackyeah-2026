import type {
  Account,
  ActivityLog,
  AssistantSummary,
  AuthSession,
  BuildPlanInput,
  ChatMessage,
  ChatTurn,
  ChooseAgain,
  CreateLogInput,
  EmailLookup,
  FeedbackOverview,
  LastExerciseResult,
  LocalDate,
  PlannedSession,
  PlanState,
  PlanVersion,
  PlanWeek,
  Preferences,
  SaveFeedbackInput,
  SendChatInput,
  SportDefinition,
  UpdateLogInput,
} from './types';

/**
 * Everything the app asks the backend. Implemented by the in-memory mock
 * (`src/api/mock`) until the NestJS API exists; an HTTP implementation will
 * replace it behind the same interface. Methods reject with `ApiError`.
 * The caller is always the signed-in user: no method takes a user ID.
 */
export interface ApiClient {
  auth: {
    getSession(): Promise<AuthSession | null>;
    lookupEmail(email: string): Promise<EmailLookup>;
    /** Rejects with invalid_credentials on a wrong password (1.3). */
    signInWithEmail(email: string, password: string): Promise<AuthSession>;
    /** Rejects with weak_password under 8 characters, email_taken if it exists. */
    signUpWithEmail(email: string, password: string): Promise<AuthSession>;
    signInWithGoogle(): Promise<AuthSession>;
    sendPasswordReset(email: string): Promise<void>;
    signOut(): Promise<void>;
  };
  catalog: {
    listSports(): Promise<SportDefinition[]>;
  };
  preferences: {
    /** Null until onboarding is saved. */
    get(): Promise<Preferences | null>;
    save(preferences: Preferences): Promise<Preferences>;
  };
  plan: {
    getState(): Promise<PlanState>;
    /** Starts generation of the first plan (or a retry after failure); poll getState until it settles. */
    build(input: BuildPlanInput): Promise<PlanState>;
    /** Any Monday from first_week_start to the week after planned_through. */
    getWeek(weekStart: LocalDate): Promise<PlanWeek>;
    /** Sessions and extras whose local day is in [from, to], for the Calendar month. */
    listSessions(range: { from: LocalDate; to: LocalDate }): Promise<{
      sessions: PlannedSession[];
      extras: ActivityLog[];
    }>;
    getSession(id: string): Promise<PlannedSession>;
    /** Newest first. */
    listVersions(): Promise<PlanVersion[]>;
    /** Home 5.4: the person saw the Plan updated note. */
    dismissRecentChange(): Promise<void>;
  };
  logs: {
    /** Marks the session completed and returns its log. */
    create(input: CreateLogInput): Promise<ActivityLog>;
    get(id: string): Promise<ActivityLog>;
    update(id: string, patch: UpdateLogInput): Promise<ActivityLog>;
    saveFeedback(logId: string, feedback: SaveFeedbackInput): Promise<ActivityLog>;
    /** The most recent logged sets of an exercise (by exercise_id, else name), or null. */
    lastForExercise(exercise: { exercise_id?: string; name: string }): Promise<LastExerciseResult | null>;
  };
  chat: {
    /** The whole conversation, oldest first. */
    listMessages(): Promise<ChatMessage[]>;
    /** Applies a valid change straight away; rejects with generation_failed, stale_version or offline. */
    send(input: SendChatInput): Promise<ChatTurn>;
    /** Undo a change card (restores the previous plan as a new version) or remove a logged workout. */
    undo(messageId: string): Promise<ChatTurn>;
  };
  profile: {
    getSummary(): Promise<AssistantSummary>;
    getFeedback(): Promise<FeedbackOverview>;
    /** Null clears the opinion ("Try again" sets the card back to no opinion). */
    setOpinion(activityKey: string, opinion: ChooseAgain | null): Promise<FeedbackOverview>;
    /** Clears every opinion; keeps history, answers and switched-off activities. */
    resetFeedback(): Promise<FeedbackOverview>;
    setSportExcluded(sportId: string, excluded: boolean): Promise<FeedbackOverview>;
  };
  account: {
    get(): Promise<Account>;
  };
}
