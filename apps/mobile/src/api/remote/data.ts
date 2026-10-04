/**
 * Cached reads of the product API for the signed-in user. Screens ask for
 * many derived views at once (state, two weeks, a session, the log), and each
 * needs the full plan history and completions; this loader fetches each
 * collection once (in-flight requests are shared, results live ~15 s), pages
 * collections fully, and drops everything when the user changes. After a
 * write, call `invalidate(...)` with what changed; React Query refetches on
 * top of it.
 */
import { debugLog } from '../../lib/debug-log';
import { slugForSportName } from '../../lib/sport-library';
import { ApiError } from '../types';
import type { RemoteDeps } from './deps';
import { serverErrorCode, type ProductApi } from './http';
import {
  MAX_OFFSET,
  PAGE_LIMIT,
  type ActivePlanDto,
  type ActivityCompletionEntity,
  type ActivityOpinionEntity,
  type ChatMessageEntity,
  type PlannedActivity,
  type PlanVersionEntity,
  type ProfileEntity,
  type SportEntity,
} from './wire';

export const CACHE_TTL_MS = 15_000;

/** What `invalidate` can drop. `chat` drops every plan's messages. */
export type RemoteDataKey = 'profile' | 'sports' | 'currentPlan' | 'history' | 'completions' | 'opinions' | 'chat';

/**
 * Sport ID translation. The app keeps slug IDs (`walking`); the API uses
 * catalog decimal IDs ("3"), matched by catalog name to the sport library.
 * Sports the library does not know become `sport-<id>`.
 */
export interface SportIds {
  /** A slug, `sport-<id>` or a catalog ID → the catalog ID; null when the catalog has no such sport. */
  toWire(appId: string): string | null;
  /** A catalog ID → the app's ID. */
  toApp(wireId: string): string;
}

export interface FoundActivity {
  activity: PlannedActivity;
  /** The version the activity is read from (and completed against). */
  version: PlanVersionEntity;
}

export interface RemoteData {
  /** The signed-in user's ID (for storage keys); rejects with unauthorized when signed out. */
  userId(): Promise<string>;
  /** GET /profile, or null when the account has no profile row yet (404). */
  profile(): Promise<ProfileEntity | null>;
  /** GET /sports, the whole catalog including previews. */
  sports(): Promise<SportEntity[]>;
  sportIds(): Promise<SportIds>;
  toWireSportId(appId: string): Promise<string | null>;
  toAppSportId(wireId: string): Promise<string>;
  /** GET /plans/current: the active plan and version, or null before the first plan. */
  currentPlan(): Promise<ActivePlanDto | null>;
  /** Every plan version, newest first (all pages). */
  history(): Promise<PlanVersionEntity[]>;
  /** Every completion, newest completed_at first (all pages). */
  completions(): Promise<ActivityCompletionEntity[]>;
  /** GET /opinions, newest first; [] while the server has no such endpoint. */
  opinions(): Promise<ActivityOpinionEntity[]>;
  /** A plan's chat, oldest first (all pages). */
  chat(planId: string): Promise<ChatMessageEntity[]>;

  /** week_start → the highest version planned for that week (a revision never counts twice). */
  weekSnapshots(): Promise<Map<string, PlanVersionEntity>>;
  versionById(id: string): Promise<PlanVersionEntity | null>;
  versionByNumber(version: number): Promise<PlanVersionEntity | null>;
  completionByActivityId(): Promise<Map<string, ActivityCompletionEntity>>;
  /**
   * Where an activity lives: in the version its completion was saved against,
   * else in the newest version containing it (its week's snapshot, unless a
   * later revision removed it). Null when no version has it.
   */
  findActivity(activityId: string): Promise<FoundActivity | null>;

  /** Store what PUT /profile returned, skipping a reload. */
  setProfile(value: ProfileEntity): void;
  /** Store the plan a write returned (generate, chat plan_updated, undo), skipping a reload. */
  setCurrentPlan(value: ActivePlanDto | null): void;
  /** Drop cached values so the next read refetches. No keys: everything. */
  invalidate(...keys: RemoteDataKey[]): void;
  /** Drop everything (sign-out). */
  reset(): void;
}

interface Slot<T> {
  get(load: () => Promise<T>): Promise<T>;
  set(value: T): void;
  clear(): void;
}

/** One cached value: shared while loading, fresh for the TTL, dropped on failure. */
function createSlot<T>(now: () => number, ttlMs: number): Slot<T> {
  let entry: { promise: Promise<T>; settledAt: number | null } | null = null;
  return {
    get(load) {
      if (entry && (entry.settledAt === null || now() - entry.settledAt < ttlMs)) return entry.promise;
      const promise: Promise<T> = load().then(
        (value) => {
          // Only the latest load counts; an invalidated one just answers its own caller.
          if (entry?.promise === promise) entry.settledAt = now();
          return value;
        },
        (error: unknown) => {
          if (entry?.promise === promise) entry = null;
          throw error;
        },
      );
      entry = { promise, settledAt: null };
      return promise;
    },
    set(value) {
      entry = { promise: Promise.resolve(value), settledAt: now() };
    },
    clear() {
      entry = null;
    },
  };
}

export function createRemoteData(http: ProductApi, deps: Pick<RemoteDeps, 'auth' | 'now'>, ttlMs = CACHE_TTL_MS): RemoteData {
  const now = () => deps.now().getTime();
  const slot = <T>(): Slot<T> => createSlot<T>(now, ttlMs);
  const slots = {
    profile: slot<ProfileEntity | null>(),
    sports: slot<SportEntity[]>(),
    currentPlan: slot<ActivePlanDto | null>(),
    history: slot<PlanVersionEntity[]>(),
    completions: slot<ActivityCompletionEntity[]>(),
    opinions: slot<ActivityOpinionEntity[]>(),
  };
  const chats = new Map<string, Slot<ChatMessageEntity[]>>();
  let owner: string | null = null;

  function clearAll() {
    Object.values(slots).forEach((s) => s.clear());
    chats.clear();
  }

  async function userId(): Promise<string> {
    let id: string | undefined;
    try {
      const { data } = await deps.auth.getSession();
      id = data.session?.user.id;
    } catch (error) {
      throw new ApiError('offline', "You're offline. Check your connection and try again.", { cause: error });
    }
    if (!id) throw new ApiError('unauthorized', "You've been signed out. Sign in again to continue.");
    if (owner !== id) {
      // Another account signed in: nothing cached may leak across.
      if (owner !== null) debugLog('query', 'data cache: cleared, another account signed in');
      clearAll();
      owner = id;
    }
    return id;
  }

  /** Reads through a slot after checking whose data it holds. */
  async function read<T>(target: { get(load: () => Promise<T>): Promise<T> }, load: () => Promise<T>): Promise<T> {
    await userId();
    return target.get(load);
  }

  async function allPages<T>(path: string, query: Record<string, string> = {}): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE_LIMIT) {
      const page = await http.get<T[]>(path, { ...query, limit: PAGE_LIMIT, offset });
      rows.push(...page);
      if (page.length < PAGE_LIMIT) break;
    }
    return rows;
  }

  const sports = () => read(slots.sports, () => http.get<SportEntity[]>('/sports'));

  async function sportIds(): Promise<SportIds> {
    const catalog = await sports();
    const slugToWire = new Map<string, string>();
    const wireToApp = new Map<string, string>();
    for (const sport of catalog) {
      const slug = slugForSportName(sport.name);
      // A second row with a known name (should not happen) keeps its numeric ID.
      if (slug && !slugToWire.has(slug)) {
        slugToWire.set(slug, sport.id);
        wireToApp.set(sport.id, slug);
      } else {
        wireToApp.set(sport.id, `sport-${sport.id}`);
      }
    }
    return {
      toWire(appId) {
        const fromSlug = slugToWire.get(appId);
        if (fromSlug) return fromSlug;
        const numeric = /^sport-(\d+)$/.exec(appId)?.[1] ?? appId;
        return wireToApp.has(numeric) ? numeric : null;
      },
      toApp: (wireId) => wireToApp.get(wireId) ?? `sport-${wireId}`,
    };
  }

  const history = () =>
    read(slots.history, async () =>
      (await allPages<PlanVersionEntity>('/plans/history')).sort((a, b) => b.version - a.version),
    );

  const currentPlan = () => read(slots.currentPlan, () => http.get<ActivePlanDto | null>('/plans/current'));

  const completions = () =>
    read(slots.completions, async () =>
      (await allPages<ActivityCompletionEntity>('/completions')).sort(
        (a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at),
      ),
    );

  /** History plus the active version, newest first (the active one may be newer than a cached history). */
  async function allVersions(): Promise<PlanVersionEntity[]> {
    const [list, current] = await Promise.all([history(), currentPlan()]);
    if (!current || list.some((v) => v.id === current.version.id)) return list;
    return [current.version, ...list].sort((a, b) => b.version - a.version);
  }

  async function weekSnapshots(): Promise<Map<string, PlanVersionEntity>> {
    const weeks = new Map<string, PlanVersionEntity>();
    for (const version of await allVersions()) {
      const known = weeks.get(version.plan.week_start);
      if (!known || version.version > known.version) weeks.set(version.plan.week_start, version);
    }
    return weeks;
  }

  async function completionByActivityId(): Promise<Map<string, ActivityCompletionEntity>> {
    return new Map((await completions()).map((completion) => [completion.activity_id, completion]));
  }

  async function findActivity(activityId: string): Promise<FoundActivity | null> {
    const [versions, done] = await Promise.all([allVersions(), completionByActivityId()]);
    const completion = done.get(activityId);
    const savedIn = completion ? versions.find((v) => v.id === completion.plan_version_id) : undefined;
    const inSaved = savedIn?.plan.activities.find((a) => a.id === activityId);
    if (savedIn && inSaved) return { activity: inSaved, version: savedIn };
    for (const version of versions) {
      const activity = version.plan.activities.find((a) => a.id === activityId);
      if (activity) return { activity, version };
    }
    return null;
  }

  return {
    userId,
    profile: () =>
      read(slots.profile, async () => {
        try {
          return await http.get<ProfileEntity>('/profile');
        } catch (error) {
          if (error instanceof ApiError && error.code === 'not_found') return null;
          throw error;
        }
      }),
    sports,
    sportIds,
    toWireSportId: async (appId) => (await sportIds()).toWire(appId),
    toAppSportId: async (wireId) => (await sportIds()).toApp(wireId),
    currentPlan,
    history,
    completions,
    opinions: () =>
      read(slots.opinions, async () => {
        try {
          return await http.get<ActivityOpinionEntity[]>('/opinions');
        } catch (error) {
          // Until the opinions extension is deployed the router answers 404 or 405.
          const code = serverErrorCode(error);
          if (code === 'NOT_FOUND' || code === 'METHOD_NOT_ALLOWED') return [];
          throw error;
        }
      }),
    chat: (planId) => {
      let target = chats.get(planId);
      if (!target) {
        target = slot<ChatMessageEntity[]>();
        chats.set(planId, target);
      }
      return read(target, async () =>
        (await allPages<ChatMessageEntity>('/chat/messages', { plan_id: planId })).sort(
          (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
        ),
      );
    },
    weekSnapshots,
    versionById: async (id) => (await allVersions()).find((v) => v.id === id) ?? null,
    versionByNumber: async (number) => (await allVersions()).find((v) => v.version === number) ?? null,
    completionByActivityId,
    findActivity,
    setProfile: (value) => slots.profile.set(value),
    setCurrentPlan: (value) => slots.currentPlan.set(value),
    invalidate(...keys) {
      debugLog('query', `data cache: invalidate ${keys.length ? keys.join(', ') : 'everything'}`);
      if (keys.length === 0) {
        clearAll();
        return;
      }
      for (const key of keys) {
        if (key === 'chat') chats.clear();
        else slots[key].clear();
      }
    },
    reset() {
      debugLog('query', 'data cache: reset');
      clearAll();
      owner = null;
    },
  };
}
