/**
 * Logged sessions that are not saved to the server yet. The product API
 * saves a completion in one immutable POST, while the app logs first, lets a
 * gym session fix its sets, and asks for feedback after. So `logs.create`
 * keeps a local draft (ID `draft:<uuid>`) that Home already shows as done, and
 * the draft becomes a completion when feedback is saved or the feedback screen
 * closes (`logs.commit`). Drafts survive restarts and are flushed at the next
 * signed-in start. Stored per user in AsyncStorage.
 */
import type { IsoDateTime, LoggedSet, LogSource, MetricValue } from '../types';
import type { KeyValueStorage } from './deps';
import type { CompleteActivityDto } from './wire';

export const DRAFT_PREFIX = 'draft:';

export interface Draft {
  /** `draft:<uuid>`: the log ID the app sees until the completion is saved. */
  id: string;
  /** The completion's request_id: made once with the draft, sent with every attempt. */
  request_id: string;
  activity_id: string;
  /** The version whose snapshot holds the activity (not always the active one). */
  plan_version_id: string;
  /** The app's slug ID. */
  sport_id: string;
  title: string;
  started_at: IsoDateTime;
  duration_seconds: number;
  source: LogSource;
  file_name: string | null;
  /** App shape: the session-duration metric in seconds. */
  metrics: Record<string, MetricValue>;
  sets: LoggedSet[];
  ended_early: boolean;
  created_at: IsoDateTime;
  /**
   * The exact body last sent to POST /completions, kept until it succeeds, so
   * a retry after a transport failure resends it unchanged. Null before sending.
   */
  submission: CompleteActivityDto | null;
}

export interface DraftStore {
  /** The signed-in user's drafts, oldest first. */
  list(): Promise<Draft[]>;
  get(id: string): Promise<Draft | null>;
  /** Adds or replaces by id. */
  put(draft: Draft): Promise<void>;
  remove(id: string): Promise<void>;
}

export function isDraftId(id: string): boolean {
  return id.startsWith(DRAFT_PREFIX);
}

export function newDraftId(newId: () => string): string {
  return `${DRAFT_PREFIX}${newId()}`;
}

export const draftStorageKey = (userId: string) => `movo.remote.drafts.v1.${userId}`;

/** A draft store over key-value storage; `userId` picks the signed-in user's key. */
export function createDraftStore(storage: KeyValueStorage, userId: () => Promise<string>): DraftStore {
  // Writes run one after another, so two quick saves never overwrite each other.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  async function read(key: string): Promise<Draft[]> {
    const raw = await storage.getItem(key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Draft[]) : [];
    } catch {
      // Unreadable local data cannot be recovered; start over rather than block logging.
      return [];
    }
  }

  const write = (key: string, drafts: Draft[]) =>
    drafts.length ? storage.setItem(key, JSON.stringify(drafts)) : storage.removeItem(key);

  return {
    list: () => serial(async () => read(draftStorageKey(await userId()))),
    get: (id) =>
      serial(async () => (await read(draftStorageKey(await userId()))).find((draft) => draft.id === id) ?? null),
    put: (draft) =>
      serial(async () => {
        const key = draftStorageKey(await userId());
        const drafts = await read(key);
        const index = drafts.findIndex((item) => item.id === draft.id);
        if (index >= 0) drafts[index] = draft;
        else drafts.push(draft);
        await write(key, drafts);
      }),
    remove: (id) =>
      serial(async () => {
        const key = draftStorageKey(await userId());
        await write(
          key,
          (await read(key)).filter((draft) => draft.id !== id),
        );
      }),
  };
}
