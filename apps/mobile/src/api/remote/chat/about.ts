/**
 * The session a sent message was about ("Today · Walk-run intervals"). The
 * API stores the attached activity with the request, not with the message, so
 * the app remembers it per user, keyed by the message's request_id. Losing it
 * only drops the chip above an old bubble.
 */
import type { SessionRef } from '../../types';
import type { KeyValueStorage } from '../deps';

/** Older entries are dropped beyond this. */
const MAX_ENTRIES = 200;

export const aboutStorageKey = (userId: string) => `movo.remote.chat-about.v1.${userId}`;

export interface AboutStore {
  /** request_id → session, for the signed-in user. */
  read(): Promise<Record<string, SessionRef>>;
  save(requestId: string, about: SessionRef): Promise<void>;
}

export function createAboutStore(storage: KeyValueStorage, userId: () => Promise<string>): AboutStore {
  async function load(key: string): Promise<Record<string, SessionRef>> {
    try {
      const parsed: unknown = JSON.parse((await storage.getItem(key)) ?? '{}');
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, SessionRef>)
        : {};
    } catch {
      return {};
    }
  }

  return {
    read: async () => load(aboutStorageKey(await userId())),
    async save(requestId, about) {
      const key = aboutStorageKey(await userId());
      const entries = Object.entries(await load(key)).filter(([id]) => id !== requestId);
      entries.push([requestId, about]);
      await storage.setItem(key, JSON.stringify(Object.fromEntries(entries.slice(-MAX_ENTRIES))));
    },
  };
}
