import type {
  ActivePlanDto,
  ActivityCompletionEntity,
  ChatMessageEntity,
  CompleteActivityDto,
  GeneratePlanDto,
  PlanSnapshotDto,
  PlanVersionEntity,
  ProfileEntity,
  SendChatDto,
  SportEntity,
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
  listMessages(planId: string, page: Page): Promise<ChatMessageEntity[]>;
  recentMessages(planId: string): Promise<ChatMessageEntity[]>;
  requestMessages(planId: string, requestId: string): Promise<ChatMessageEntity[]>;
  contextCompletions(activityIds: string[]): Promise<ActivityCompletionEntity[]>;
  savedRequest(requestId: string, input: GeneratePlanDto | SendChatDto): Promise<unknown | null>;
  listCompletions(page: Page): Promise<ActivityCompletionEntity[]>;
  savePlan(input: {
    request: GeneratePlanDto | SendChatDto;
    origin: 'generate' | 'revise';
    plan: PlanSnapshotDto;
    summary: string;
  }): Promise<ActivePlanDto>;
  saveReply(
    input: SendChatDto,
    reply: string,
    outcome: 'reply' | 'clarification',
  ): Promise<ChatMessageEntity[]>;
  complete(input: CompleteActivityDto): Promise<ActivityCompletionEntity>;
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
export interface ApiDependencies {
  authenticate(token: string): Promise<{ id: string }>;
  store(userId: string, token: string): ProductStore;
  generator: PlanGenerator;
}
