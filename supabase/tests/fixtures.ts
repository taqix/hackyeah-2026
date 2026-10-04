import {
  apiSchemas,
  preferencesSchema,
  planSnapshotSchema,
} from '../../packages/contracts/src/product.ts';

export const owner = '00000000-0000-4000-8000-000000000001';
export const planId = '00000000-0000-4000-8000-000000000002';
export const versionId = '00000000-0000-4000-8000-000000000003';
export const activityId = '00000000-0000-4000-8000-000000000004';
export const requestId = '00000000-0000-4000-8000-000000000005';
export const preferences = preferencesSchema.parse({
  starting_comfort: 'starting_out',
  sessions_per_week: 2,
  session_minutes: 20,
  preferred_window: { start_hour: 7, end_hour: 21 },
  activity_interests: ['1'],
  discovery_preference: 'selected_only',
  available_locations: ['outdoors'],
  available_equipment: [],
  avoidances: [],
  starting_obstacles: ['uncertainty'],
  excluded_activity_types: [],
  timezone: 'Europe/Warsaw',
});
export const sports = [
  {
    id: '1',
    name: 'Running',
    is_gym: false,
    generation_enabled: true,
    metrics: [
      {
        key: 'duration_minutes',
        label: 'Time',
        unit: 'min',
        type: 'number' as const,
        required: true,
        minimum: 0,
      },
    ],
  },
];
export const profile = {
  id: owner,
  username: 'Demo',
  created_at: '2026-10-03T12:00:00Z',
  preferences,
};
export const snapshot = planSnapshotSchema.parse({
  week_start: '2026-10-05',
  timezone: 'Europe/Warsaw',
  activities: [
    {
      id: activityId,
      sport_id: '1',
      title: 'A gentle walk and jog',
      description: 'Walk comfortably, with short gentle jogs if you feel ready.',
      start_at: '2026-10-05T09:00:00+02:00',
      duration_minutes: 20,
      gym_exercises: [],
    },
  ],
});
export const activePlan = {
  plan: {
    id: planId,
    profile_id: owner,
    active_version_id: versionId,
    created_at: '2026-10-03T12:00:00Z',
  },
  version: {
    id: versionId,
    plan_id: planId,
    profile_id: owner,
    version: 1,
    origin: 'generate' as const,
    plan: snapshot,
    summary: 'Your first gentle session is ready.',
    created_at: '2026-10-03T12:00:00Z',
  },
};
export const availability = {
  source: 'manual' as const,
  captured_at: '2026-10-03T12:00:00Z',
  slots: [
    {
      start_at: '2026-10-05T07:00:00+02:00',
      end_at: '2026-10-05T21:00:00+02:00',
    },
  ],
};
export const generation = {
  request_id: requestId,
  expected_version: 0,
  sport_id: '1',
  week_start: snapshot.week_start,
  availability,
};
export const chat = {
  request_id: requestId,
  plan_id: planId,
  expected_version: 1,
  message: 'Could you explain this session?',
  availability,
};
export const messages = [
  {
    id: '00000000-0000-4000-8000-000000000006',
    profile_id: owner,
    plan_id: planId,
    role: 'user' as const,
    content: chat.message,
    outcome: null,
    plan_version_id: null,
    created_at: '2026-10-03T12:00:00Z',
    request_id: requestId,
  },
  {
    id: '00000000-0000-4000-8000-000000000007',
    profile_id: owner,
    plan_id: planId,
    role: 'assistant' as const,
    content: 'Start with a comfortable walk. The plan is unchanged.',
    outcome: 'reply' as const,
    plan_version_id: versionId,
    created_at: '2026-10-03T12:00:00Z',
    request_id: requestId,
  },
];
export const completion = {
  plan_version_id: versionId,
  activity_id: activityId,
  request_id: requestId,
  metrics: { duration_minutes: 20 },
  gym_log: [],
  feedback: {
    effort: 'okay' as const,
    enjoyment: 'yes' as const,
    notes: 'A comfortable start.',
  },
  completed_at: '2026-10-05T09:20:00+02:00',
};
export const completionId = '00000000-0000-4000-8000-000000000008';
export const opinion = {
  activity_key: 'a-gentle-walk-and-jog',
  title: snapshot.activities[0]!.title,
  sport_id: '1',
  opinion: 'yes' as const,
  last_date: '2026-10-05',
  updated_at: '2026-10-05T09:30:00Z',
};
export const undoRequest = {
  request_id: '00000000-0000-4000-8000-000000000009',
  plan_id: planId,
  expected_version: 2,
};
// After a revision (version 2), Undo saves the version 1 snapshot again as version 3.
export const undonePlan = {
  plan: { ...activePlan.plan, active_version_id: '00000000-0000-4000-8000-000000000010' },
  version: {
    ...activePlan.version,
    id: '00000000-0000-4000-8000-000000000010',
    version: 3,
    origin: 'undo' as const,
    summary: 'The last change was undone.',
    created_at: '2026-10-03T12:10:00Z',
  },
};
// Placeholders shaped like tokens; never real Google credentials.
export const googleToken = {
  request: { refresh_token: 'synthetic-google-refresh-token' },
  result: { access_token: 'synthetic-google-access-token', expires_in: 3599 },
};
const meta = { contract_version: '1', request_id: null };
export const examples = {
  UpdateProfileDto: { username: profile.username, preferences },
  GeneratePlanDto: generation,
  SendChatDto: chat,
  CompleteActivityDto: completion,
  UpdateFeedbackDto: { completion_id: completionId, feedback: completion.feedback },
  PutOpinionDto: {
    activity_key: opinion.activity_key,
    title: opinion.title,
    sport_id: opinion.sport_id,
    opinion: opinion.opinion,
    last_date: opinion.last_date,
  },
  ResetOpinionsDto: {},
  UndoPlanDto: undoRequest,
  GoogleTokenDto: googleToken.request,
  SchemaResponse: { data: { Example: { type: 'object' } }, meta },
  ProfileResponse: { data: profile, meta },
  SportListResponse: { data: sports, meta },
  CurrentPlanResponse: { data: activePlan, meta },
  GeneratePlanResponse: {
    data: activePlan,
    meta: { ...meta, request_id: requestId },
  },
  PlanHistoryResponse: { data: [activePlan.version], meta },
  ChatMessagesResponse: { data: messages, meta },
  ChatResponse: {
    data: { outcome: 'reply', active_plan: null, messages },
    meta: { ...meta, request_id: requestId },
  },
  CompletionResponse: {
    data: {
      ...completion,
      id: completionId,
      profile_id: owner,
    },
    meta: { ...meta, request_id: requestId },
  },
  CompletionListResponse: { data: [], meta },
  OpinionListResponse: { data: [opinion], meta },
  OpinionResponse: { data: opinion, meta },
  ResetOpinionsResponse: { data: { cleared: 1 }, meta },
  UndoPlanResponse: { data: undonePlan, meta: { ...meta, request_id: undoRequest.request_id } },
  GoogleTokenResponse: { data: googleToken.result, meta },
  ErrorResponse: {
    error: {
      code: 'AI_NOT_CONFIGURED',
      message: 'The AI provider is not connected yet.',
      retryable: false,
    },
    meta,
  },
};
for (const name of Object.keys(apiSchemas) as (keyof typeof apiSchemas)[])
  apiSchemas[name].parse(examples[name]);

// Additional design states for clients: these are synthetic and never seed the database.
export const designExamples = {
  ExploreFromPreferences: {
    schema: 'GeneratePlanDto',
    value: { ...generation, sport_id: null },
  },
  QuietWeek: {
    schema: 'GeneratePlanResponse',
    value: {
      data: {
        ...activePlan,
        version: {
          ...activePlan.version,
          plan: { ...snapshot, activities: [] },
          summary: 'No session fits this week.',
        },
      },
      meta: { ...meta, request_id: requestId },
    },
  },
  EndedEarlyWithoutOpinion: {
    schema: 'CompleteActivityDto',
    value: {
      ...completion,
      feedback: { effort: 'too_much', enjoyment: null, notes: 'Stopped early.' },
    },
  },
  LoggedBeforeFeedback: {
    schema: 'CompleteActivityDto',
    value: { ...completion, feedback: null },
  },
  ClearOpinion: {
    schema: 'PutOpinionDto',
    value: { ...examples.PutOpinionDto, opinion: null },
  },
  OpinionCleared: {
    schema: 'OpinionResponse',
    value: { data: null, meta },
  },
  NothingToUndo: {
    schema: 'ErrorResponse',
    value: {
      error: {
        code: 'NOTHING_TO_UNDO',
        message: 'There is no recent change to undo.',
        retryable: false,
      },
      meta: { ...meta, request_id: undoRequest.request_id },
    },
  },
} as const;
for (const example of Object.values(designExamples))
  apiSchemas[example.schema].parse(example.value);
