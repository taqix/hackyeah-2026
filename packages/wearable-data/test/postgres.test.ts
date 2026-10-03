import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresWearableStore, WearableService } from '../dist/index.js';
import { connection, event, changedEvent, range } from './fixtures.js';

// Runs the real migration/queries against PostgreSQL WASM. No mock SQL or hosted database.
describe('PostgreSQL repository', () => {
  const database = new PGlite();
  const service = new WearableService(
    new PostgresWearableStore({ transaction: (run) => database.transaction(run) }),
  );
  beforeAll(async () => {
    await database.exec(
      readFileSync(
        new URL(
          '../../../supabase/migrations/20261003120000_wearable_extraction.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await service.registerConnection('alice', connection());
  });
  afterAll(async () => {
    await database.close();
  });
  it('commits atomically, persists revisions and rolls back a changed receipt', async () => {
    await service.ingest('alice', [event()]);
    await expect(
      service.ingest('alice', [
        event({ external_id: 'workout:2', ingest_event_id: 'two' }),
        changedEvent({ ingest_event_id: 'event-1' }),
      ]),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect((await service.records('alice', range)).records).toHaveLength(1);
    await service.ingest('alice', [changedEvent()]);
    const reopened = new WearableService(
      new PostgresWearableStore({ transaction: (run) => database.transaction(run) }),
    );
    expect((await reopened.records('alice', range)).records[0]?.version).toBe(2);
    expect((await reopened.records('bob', range)).records).toEqual([]);
  });
  it('serializes concurrent duplicate submissions', async () => {
    const input = event({ ingest_event_id: 'parallel', external_id: 'workout:parallel' });
    const [a, b] = await Promise.all([
      service.ingest('alice', [input]),
      service.ingest('alice', [input]),
    ]);
    expect(a).toEqual(b);
    expect((await service.records('alice', range)).records).toHaveLength(2);
  });
  it('denies direct client reads even if table SELECT was granted', async () => {
    await database.exec(
      'CREATE ROLE wearable_test_client; GRANT SELECT ON wearable_records TO wearable_test_client; SET ROLE wearable_test_client',
    );
    try {
      expect((await database.query('SELECT * FROM wearable_records')).rows).toEqual([]);
    } finally {
      await database.exec('RESET ROLE');
    }
  });
});
