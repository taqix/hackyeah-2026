import type { Entities, WearableStore } from '../types.js';

export interface SqlSession {
  query<T>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>;
}
/** Wrap Pool.connect/BEGIN/COMMIT/ROLLBACK/release, or a driver's transaction API. */
export interface TransactionalSql {
  transaction<T>(run: (session: SqlSession) => Promise<T>): Promise<T>;
}
const tables = {
  connections: 'wearable_connections',
  records: 'wearable_records',
  revisions: 'wearable_revisions',
  receipts: 'wearable_receipts',
  checkpoints: 'wearable_checkpoints',
  consents: 'wearable_consents',
  leases: 'wearable_leases',
} as const;

export class PostgresWearableStore implements WearableStore {
  constructor(private readonly database: TransactionalSql) {}

  transaction<T>(
    owner: string,
    run: (tx: import('../types.js').WearableTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (sql) => {
      // Serializes source identity across connection IDs, reconnects and workers.
      await sql.query(
        'INSERT INTO wearable_owner_locks (owner_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [owner],
      );
      await sql.query('SELECT owner_id FROM wearable_owner_locks WHERE owner_id = $1 FOR UPDATE', [
        owner,
      ]);
      return run({
        get: async <K extends keyof Entities>(table: K, key: string) => {
          const result = await sql.query<{ body: Entities[K] }>(
            `SELECT body FROM ${tables[table]} WHERE owner_id = $1 AND key = $2`,
            [owner, key],
          );
          return result.rows[0]?.body ?? null;
        },
        set: async (table, key, value) => {
          await sql.query(
            `INSERT INTO ${tables[table]} (owner_id, key, body) VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (owner_id, key) DO UPDATE SET body = EXCLUDED.body`,
            [owner, key, JSON.stringify(value)],
          );
        },
        list: async <K extends keyof Entities>(table: K) => {
          const result = await sql.query<{ body: Entities[K] }>(
            `SELECT body FROM ${tables[table]} WHERE owner_id = $1 ORDER BY key`,
            [owner],
          );
          return result.rows.map((row) => row.body);
        },
        remove: async (table, key) => {
          await sql.query(`DELETE FROM ${tables[table]} WHERE owner_id = $1 AND key = $2`, [
            owner,
            key,
          ]);
        },
      });
    });
  }
}
