import type { Entities, WearableStore, WearableTransaction } from '../types.js';

/** Deterministic demo/test store. Never use this for an HTTP durable acknowledgement. */
export class MemoryWearableStore implements WearableStore {
  private state = new Map<string, Entities[keyof Entities]>();
  private pending: Promise<unknown> = Promise.resolve();

  transaction<T>(owner: string, run: (tx: WearableTransaction) => Promise<T>): Promise<T> {
    const result = this.pending.then(async () => {
      const draft = structuredClone(this.state);
      const key = (table: keyof Entities, id: string) => JSON.stringify([owner, table, id]);
      const tx: WearableTransaction = {
        get: async <K extends keyof Entities>(table: K, id: string) =>
          structuredClone(draft.get(key(table, id)) as Entities[K] | undefined) ?? null,
        set: async (table, id, value) => {
          draft.set(key(table, id), structuredClone(value));
        },
        list: async <K extends keyof Entities>(table: K) =>
          [...draft.entries()]
            .filter(([id]) => {
              const parts: string[] = JSON.parse(id);
              return parts[0] === owner && parts[1] === table;
            })
            .map(([, value]) => structuredClone(value as Entities[K])),
        remove: async (table, id) => {
          draft.delete(key(table, id));
        },
      };
      const output = await run(tx);
      this.state = draft;
      return output;
    });
    this.pending = result.catch(() => undefined);
    return result;
  }
}
