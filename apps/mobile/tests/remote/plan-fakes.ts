/**
 * An in-memory product API for the plan and preferences tests: profile,
 * sports, the plan history, completions and chat as plain state, and
 * POST /plans/generate answered by a handler the test controls (or holds).
 */
import type { FetchLike } from '../../src/api/remote/deps';
import type {
  ActivePlanDto,
  ActivityCompletionEntity,
  ChatMessageEntity,
  GeneratePlanDto,
  PlanVersionEntity,
  PreferencesDto,
  ProfileEntity,
} from '../../src/api/remote/wire';
import { PLAN_ID, SPORTS, USER_ID, uuid, version, type Reply } from './fakes';

export const PREFERENCES: PreferencesDto = {
  starting_comfort: 'starting_out',
  sessions_per_week: 3,
  session_minutes: 20,
  preferred_window: { start_hour: 7, end_hour: 11 },
  activity_interests: ['1'],
  discovery_preference: 'occasional',
  available_locations: ['outdoors'],
  available_equipment: [],
  avoidances: [],
  starting_obstacles: ['time'],
  excluded_activity_types: [],
  timezone: 'Europe/Warsaw',
};

export interface Request {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  raw: string | undefined;
}

export interface ServerState {
  profile: ProfileEntity | null;
  /** Every version; the newest is active unless `activeId` says otherwise. */
  versions: PlanVersionEntity[];
  activeId: string | null;
  completions: ActivityCompletionEntity[];
  messages: ChatMessageEntity[];
  /** Answers POST /plans/generate; the default saves a version with one activity. */
  generate: (body: GeneratePlanDto) => Reply | Promise<Reply>;
}

export function message(n: number, overrides: Partial<ChatMessageEntity> = {}): ChatMessageEntity {
  return {
    id: uuid(500 + n),
    profile_id: USER_ID,
    plan_id: PLAN_ID,
    role: 'assistant',
    content: `Change ${n}.`,
    outcome: 'plan_updated',
    plan_version_id: null,
    created_at: `2026-10-06T0${n}:00:00Z`,
    request_id: uuid(600 + n),
    ...overrides,
  };
}

const envelope = (data: unknown): Reply => ({ status: 200, body: { data, meta: { contract_version: '1', request_id: null } } });

/** A promise the test resolves later, for holding a generate request open. */
export function gate<T>() {
  let open!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

export function fakeServer(initial: Partial<ServerState> = {}) {
  const state: ServerState = {
    profile: { id: USER_ID, username: 'ana', created_at: '2026-10-01T10:00:00Z', preferences: PREFERENCES },
    versions: [],
    activeId: null,
    completions: [],
    messages: [],
    generate: (body) => envelope(saveVersion(body)),
    ...initial,
  };
  const requests: Request[] = [];

  function current(): ActivePlanDto | null {
    if (!state.versions.length) return null;
    const active =
      state.versions.find((v) => v.id === state.activeId) ?? [...state.versions].sort((a, b) => b.version - a.version)[0];
    return {
      plan: { id: PLAN_ID, profile_id: USER_ID, active_version_id: active.id, created_at: '2026-10-01T10:00:00Z' },
      version: active,
    };
  }

  /** What a successful generate stores: the next version, one walk on the week's Tuesday. */
  function saveVersion(body: GeneratePlanDto): ActivePlanDto {
    const number = state.versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
    const tuesday = new Date(`${body.week_start}T07:00:00+02:00`);
    tuesday.setUTCDate(tuesday.getUTCDate() + 1);
    const saved = version(number, body.week_start, [
      {
        id: uuid(700 + number),
        sport_id: '1',
        title: `Walk ${number}`,
        description: 'An easy walk.',
        start_at: tuesday.toISOString(),
        duration_minutes: 20,
        gym_exercises: [],
      },
    ]);
    state.versions.push(saved);
    state.activeId = saved.id;
    return current() as ActivePlanDto;
  }

  async function route(request: Request): Promise<Reply> {
    const key = `${request.method} ${request.path}`;
    const offset = Number(request.query.get('offset') ?? 0);
    const page = <T>(rows: T[]) => envelope(offset === 0 ? rows : []);
    switch (key) {
      case 'GET /profile':
        return state.profile ? envelope(state.profile) : { status: 404, body: { error: { code: 'NOT_FOUND', message: 'No profile', retryable: false }, meta: { contract_version: '1', request_id: null } } };
      case 'PUT /profile': {
        const body = request.body as { username: string | null; preferences: PreferencesDto };
        state.profile = { id: USER_ID, created_at: '2026-10-01T10:00:00Z', ...body };
        return envelope(state.profile);
      }
      case 'GET /sports':
        return envelope(SPORTS);
      case 'GET /plans/current':
        return envelope(current());
      case 'GET /plans/history':
        return page([...state.versions].sort((a, b) => b.version - a.version));
      case 'GET /completions':
        return page(state.completions);
      case 'GET /chat/messages':
        return page(state.messages);
      case 'POST /plans/generate':
        return state.generate(request.body as GeneratePlanDto);
      default:
        return { status: 404, body: { error: { code: 'NOT_FOUND', message: key, retryable: false }, meta: { contract_version: '1', request_id: null } } };
    }
  }

  const fetch: FetchLike = async (url, init) => {
    const parsed = new URL(url);
    const request: Request = {
      method: init.method,
      path: parsed.pathname.replace(/^.*\/product-api/, ''),
      query: parsed.searchParams,
      body: init.body === undefined ? undefined : JSON.parse(init.body),
      raw: init.body,
    };
    requests.push(request);
    const reply = await route(request);
    if ('throws' in reply) throw reply.throws;
    if ('hang' in reply) throw new Error('hang is not supported here');
    const text = reply.text ?? (reply.body === undefined ? '' : JSON.stringify(reply.body));
    return { status: reply.status, ok: reply.status >= 200 && reply.status < 300, text: async () => text };
  };

  const generates = () => requests.filter((r) => r.method === 'POST' && r.path === '/plans/generate');

  return { state, requests, generates, fetch, saveVersion };
}

/** Lets queued promise callbacks (a finished background generate) run. */
export async function flush(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve));
}
