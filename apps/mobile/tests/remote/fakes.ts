/**
 * Fakes for the remote adapter: a scripted fetch, an in-memory Auth and
 * storage, and wire fixtures shaped like the product API's examples.
 */
import type { AuthPort, AuthSessionData, FetchInit, FetchLike, KeyValueStorage, RemoteDeps } from '../../src/api/remote/deps';
import type {
  ActivityCompletionEntity,
  PlannedActivity,
  PlanVersionEntity,
  SportEntity,
} from '../../src/api/remote/wire';
import { manualAvailability } from '../../src/services/calendar/plan-availability';

export const USER_ID = '00000000-0000-4000-8000-000000000001';
export const PLAN_ID = '00000000-0000-4000-8000-000000000002';

export interface Call {
  url: string;
  init: FetchInit;
}

export type Reply =
  | { status: number; body?: unknown; text?: string }
  | { throws: Error }
  /** Never answers; resolves only when aborted. */
  | { hang: true };

export const ok = (data: unknown): Reply => ({ status: 200, body: { data, meta: { contract_version: '1', request_id: null } } });
export const fail = (status: number, code: string, retryable = false): Reply => ({
  status,
  body: { error: { code, message: `server says ${code}`, retryable }, meta: { contract_version: '1', request_id: null } },
});

/** A fetch that answers from a list of replies (in order) or a route function. */
export function scriptedFetch(script: Reply[] | ((call: Call) => Reply)) {
  const calls: Call[] = [];
  const queue = Array.isArray(script) ? [...script] : null;
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    const reply = queue ? queue.shift() : (script as (call: Call) => Reply)(call);
    if (!reply) throw new Error(`No scripted reply for ${init.method} ${url}`);
    if ('throws' in reply) throw reply.throws;
    if ('hang' in reply) {
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }
    const text = reply.text ?? (reply.body === undefined ? '' : JSON.stringify(reply.body));
    return { status: reply.status, ok: reply.status >= 200 && reply.status < 300, text: async () => text };
  };
  return { fetch, calls };
}

export function session(userId = USER_ID, token = 'token-1'): AuthSessionData {
  return {
    access_token: token,
    refresh_token: 'refresh',
    user: { id: userId, email: 'ana@example.com', created_at: '2026-10-01T10:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} },
  };
}

export const GUEST_ID = '00000000-0000-4000-8000-000000000003';

/**
 * A guest's session as hosted Supabase answers an anonymous sign-in:
 * `is_anonymous`, an empty email and no provider in app_metadata.
 */
export function guestSession(metadata: object = { name: 'Guest', full_name: 'Guest' }): AuthSessionData {
  return {
    access_token: 'guest-token',
    refresh_token: 'guest-refresh',
    user: {
      id: GUEST_ID,
      email: '',
      is_anonymous: true,
      created_at: '2026-10-04T10:00:00Z',
      app_metadata: {},
      user_metadata: { ...metadata },
    },
  };
}

/** An in-memory Auth: `current` is the session; refreshSession hands out `refreshed`. */
export function fakeAuth(initial: AuthSessionData | null = session()) {
  const state = { current: initial, refreshed: null as AuthSessionData | null, refreshCalls: 0 };
  const result = (s: AuthSessionData | null) => ({ data: { user: s?.user ?? null, session: s }, error: null });
  const auth: AuthPort = {
    getSession: async () => ({ data: { session: state.current }, error: null }),
    signInWithPassword: async () => result(state.current),
    signUp: async () => result(state.current),
    signInAnonymously: async (credentials) => {
      state.current = guestSession(credentials?.options?.data);
      return result(state.current);
    },
    signInWithOAuth: async () => ({ data: { url: null }, error: null }),
    linkIdentity: async () => ({ data: { url: null }, error: null }),
    getUserIdentities: async () => ({
      data: { identities: [{ provider: state.current?.user.app_metadata.provider ?? 'email', identity_data: {} }] },
      error: null,
    }),
    setSession: async () => result(state.current),
    exchangeCodeForSession: async () => result(state.current),
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: state.current?.user ?? null }, error: null }),
    signOut: async () => {
      state.current = null;
      return { error: null };
    },
    refreshSession: async () => {
      state.refreshCalls += 1;
      state.current = state.refreshed;
      return result(state.current);
    },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    startAutoRefresh: async () => undefined,
    stopAutoRefresh: async () => undefined,
  };
  return { auth, state };
}

export function memoryStorage(): KeyValueStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
    removeItem: async (key) => {
      items.delete(key);
    },
  };
}

/** Deps with fakes; override what a test needs. */
export function fakeDeps(overrides: Partial<RemoteDeps> = {}): RemoteDeps {
  let id = 0;
  return {
    fetch: scriptedFetch([]).fetch,
    productApiUrl: 'https://example.supabase.co/functions/v1/product-api',
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_test',
    auth: fakeAuth().auth,
    storage: memoryStorage(),
    now: () => new Date('2026-10-07T12:00:00Z'),
    newId: () => `00000000-0000-4000-8000-${String((id += 1)).padStart(12, '0')}`,
    captureAvailability: async (options) => manualAvailability(options),
    platform: 'ios',
    openAuthSession: async () => ({ type: 'cancel' }),
    redirectUrl: (path) => `hackyeah2026://${path}`,
    secureStorage: memoryStorage(),
    googleFetch: async (url) => {
      throw new Error(`No Google fetch scripted for ${url}`);
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------ Fixtures */

export const SPORTS: SportEntity[] = [
  {
    id: '1',
    name: 'Walking',
    is_gym: false,
    generation_enabled: true,
    metrics: [
      { key: 'duration_minutes', label: 'Time', unit: 'min', type: 'number', required: true, minimum: 1 },
      { key: 'distance_km', label: 'Distance', unit: 'km', type: 'number', required: false, minimum: 0 },
      { key: 'route', label: 'Where', unit: null, type: 'text', required: false },
    ],
  },
  {
    id: '2',
    name: 'Strength',
    is_gym: true,
    generation_enabled: true,
    metrics: [{ key: 'duration_minutes', label: 'Time', unit: 'min', type: 'number', required: true, minimum: 1 }],
  },
  { id: '3', name: ' running ', is_gym: false, generation_enabled: true, metrics: [] },
  { id: '9', name: 'Tennis', is_gym: false, generation_enabled: false, metrics: [] },
  { id: '42', name: 'Underwater hockey', is_gym: false, generation_enabled: true, metrics: [] },
];

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function activity(n: number, overrides: Partial<PlannedActivity> = {}): PlannedActivity {
  return {
    id: uuid(100 + n),
    sport_id: '1',
    title: `Easy walk ${n}`,
    description: 'An easy walk at a pace where you can talk.',
    start_at: '2026-10-05T07:00:00+02:00',
    duration_minutes: 20,
    gym_exercises: [],
    ...overrides,
  };
}

export const gymActivity = (n: number, overrides: Partial<PlannedActivity> = {}): PlannedActivity =>
  activity(n, {
    sport_id: '2',
    title: 'Strength basics',
    gym_exercises: [
      { id: 'chair_squat', name: 'Chair squat', sets: [{ repetitions: 10 }, { repetitions: 10 }] },
      { id: 'wall_push_up', name: 'Wall push-up', sets: [{ repetitions: 8 }, { repetitions: 8 }] },
    ],
    ...overrides,
  });

export function version(
  number: number,
  weekStart: string,
  activities: PlannedActivity[],
  origin: PlanVersionEntity['origin'] = 'generate',
): PlanVersionEntity {
  return {
    id: uuid(200 + number),
    plan_id: PLAN_ID,
    profile_id: USER_ID,
    version: number,
    origin,
    plan: { week_start: weekStart, timezone: 'Europe/Warsaw', activities },
    summary: `Version ${number}.`,
    created_at: `2026-10-0${Math.min(number, 9)}T08:00:00Z`,
  };
}

export function completion(n: number, of: PlannedActivity, inVersion: PlanVersionEntity, overrides: Partial<ActivityCompletionEntity> = {}): ActivityCompletionEntity {
  return {
    id: uuid(300 + n),
    profile_id: USER_ID,
    plan_version_id: inVersion.id,
    activity_id: of.id,
    request_id: uuid(400 + n),
    metrics: { duration_minutes: 25 },
    gym_log: [],
    feedback: { effort: 'okay', enjoyment: 'yes', notes: '' },
    completed_at: '2026-10-05T07:30:00+02:00',
    ...overrides,
  };
}
