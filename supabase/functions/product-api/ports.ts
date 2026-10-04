import type {
  ActivePlanDto,
  ActivityCompletionEntity,
  ActivityOpinionEntity,
  ChatMessageEntity,
  CompleteActivityDto,
  GoogleTokenResultDto,
  GeneratePlanDto,
  PlanSnapshotDto,
  PlanVersionEntity,
  ProfileEntity,
  PutOpinionDto,
  SendChatDto,
  SportEntity,
  UndoPlanDto,
  UpdateFeedbackDto,
  UpdateProfileDto,
} from '../../../packages/contracts/src/product.ts';

export interface Page {
  limit: number;
  offset: number;
}
export interface ProductStore {
  getProfile(): Promise<ProfileEntity>;
  updateProfile(input: UpdateProfileDto): Promise<ProfileEntity>;
  listSports(): Promise<SportEntity[]>;
  getCurrentPlan(): Promise<ActivePlanDto | null>;
  listVersions(page: Page): Promise<PlanVersionEntity[]>;
  getVersion(planId: string, version: number): Promise<PlanVersionEntity | null>;
  listMessages(planId: string, page: Page): Promise<ChatMessageEntity[]>;
  recentMessages(planId: string): Promise<ChatMessageEntity[]>;
  requestMessages(planId: string, requestId: string): Promise<ChatMessageEntity[]>;
  contextCompletions(activityIds: string[]): Promise<ActivityCompletionEntity[]>;
  savedRequest(
    requestId: string,
    input: GeneratePlanDto | SendChatDto | UndoPlanDto,
  ): Promise<unknown | null>;
  listCompletions(page: Page): Promise<ActivityCompletionEntity[]>;
  savePlan(input: {
    request: GeneratePlanDto | SendChatDto | UndoPlanDto;
    origin: 'generate' | 'revise' | 'undo';
    plan: PlanSnapshotDto;
    summary: string;
  }): Promise<ActivePlanDto>;
  saveReply(
    input: SendChatDto,
    reply: string,
    outcome: 'reply' | 'clarification',
  ): Promise<ChatMessageEntity[]>;
  complete(input: CompleteActivityDto): Promise<ActivityCompletionEntity>;
  updateFeedback(input: UpdateFeedbackDto): Promise<ActivityCompletionEntity>;
  listOpinions(): Promise<ActivityOpinionEntity[]>;
  /** Saves the opinion, or deletes it when `opinion` is null and returns null. */
  putOpinion(input: PutOpinionDto): Promise<ActivityOpinionEntity | null>;
  /** Deletes every opinion of the owner and returns how many were removed. */
  resetOpinions(): Promise<number>;
}
export interface GeneratorContext {
  preferences: NonNullable<ProfileEntity['preferences']>;
  sports: SportEntity[];
  activePlan: ActivePlanDto | null;
  completions: ActivityCompletionEntity[];
  messages: ChatMessageEntity[];
}
export type GeneratedChat =
  | { outcome: 'plan_updated'; plan: PlanSnapshotDto; summary: string }
  | { outcome: 'reply' | 'clarification'; reply: string };
export interface PlanGenerator {
  generate(
    input: GeneratePlanDto,
    context: GeneratorContext,
  ): Promise<{ plan: PlanSnapshotDto; summary: string }>;
  chat(input: SendChatDto, context: GeneratorContext): Promise<GeneratedChat>;
}
/** Trades a Google refresh token for a new access token (Google Calendar). */
export interface GoogleTokenRefresher {
  refresh(refreshToken: string): Promise<GoogleTokenResultDto>;
}
export interface ApiDependencies {
  authenticate(token: string): Promise<{ id: string }>;
  store(userId: string, token: string): ProductStore;
  generator: PlanGenerator;
  /** Omitted: POST /google/token answers 501 GOOGLE_NOT_CONFIGURED. */
  google?: GoogleTokenRefresher;
}
