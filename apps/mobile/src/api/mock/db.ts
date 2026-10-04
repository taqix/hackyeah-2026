/**
 * Where the mock database lives: in memory, saved to AsyncStorage (debounced)
 * and read back once before the first request. A missing or outdated save is
 * replaced by the demo seed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { now } from '@/lib/clock';

import { DB_SCHEMA, type MockDb } from './model';
import { seedDb } from './seed';

export const DB_KEY = 'movo.mock-db.v1';
const WRITE_DELAY_MS = 250;

let db: MockDb | null = null;
let hydration: Promise<MockDb> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function isMockDb(value: unknown): value is MockDb {
  return typeof value === 'object' && value !== null && (value as MockDb).schema === DB_SCHEMA;
}

/** Loads the saved database once (seeding it the first time). */
export function hydrateDb(): Promise<MockDb> {
  if (db) return Promise.resolve(db);
  hydration ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(DB_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isMockDb(parsed)) db = parsed;
    } catch {
      // Unreadable storage: start from the seed.
    }
    if (!db) {
      db = seedDb(now());
      persistSoon();
    }
    return db;
  })();
  return hydration;
}

/** The live database. Only valid after `hydrateDb()`. */
export function getDb(): MockDb {
  if (!db) throw new Error('The mock database is used before it was loaded.');
  return db;
}

/** Save shortly; several changes in a row write once. */
export function persistSoon(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (db) AsyncStorage.setItem(DB_KEY, JSON.stringify(db)).catch(() => undefined);
  }, WRITE_DELAY_MS);
}

/** Wipes everything back to the demo seed (Ana's story relative to now), signed out. */
export async function resetAll(): Promise<void> {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  db = seedDb(now());
  hydration = Promise.resolve(db);
  try {
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Kept in memory; the next change saves again.
  }
}
