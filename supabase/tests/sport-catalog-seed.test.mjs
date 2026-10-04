import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { apiSchemas, sportSchema } from '../../packages/contracts/src/product.ts';
import { SPORTS } from '../../apps/mobile/src/api/mock/catalog.ts';
import { createDatabase } from './database.mjs';

const read = (file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
const schema = [
  '20261003130000_profile_sport_workout_baseline.sql',
  '20261003140000_product_persistence.sql',
  '20261004100000_feedback_opinions_undo.sql',
].map(read);
const seed = read('20261004110000_sport_catalog_seed.sql');

const earlyUser = '00000000-0000-4000-8000-000000000901';
const laterUser = '00000000-0000-4000-8000-000000000902';
const catalog = async (db) =>
  (
    await db.query(
      'SELECT id::text, name, is_gym, generation_enabled, metrics FROM public.sport ORDER BY id',
    )
  ).rows;

test('the catalog seed matches the mobile catalog, satisfies the contract and is idempotent', async () => {
  const db = await createDatabase();
  try {
    // An account from before the signup trigger existed has no profile row.
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
      earlyUser,
      'early@example.test',
    ]);
    for (const migration of schema) await db.exec(migration);
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
      laterUser,
      'later@example.test',
    ]);
    // A differently cased row is updated in place rather than duplicated.
    await db.exec(
      "INSERT INTO public.sport (name, is_gym, metrics) VALUES ('walking', false, NULL)",
    );
    const existingId = (await catalog(db))[0].id;

    await db.exec(seed);
    const first = await catalog(db);
    await db.exec(seed);
    const second = await catalog(db);
    assert.deepEqual(second, first);
    assert.equal(first.length, SPORTS.length);
    assert.equal(first.find((sport) => sport.name === 'Walking')?.id, existingId);

    assert.ok(
      apiSchemas.SportListResponse.safeParse({
        data: first,
        meta: { contract_version: '1', request_id: null },
      }).success,
    );
    for (const mock of SPORTS) {
      const row = first.find((sport) => sport.name === mock.name);
      assert.ok(row, `${mock.name} is seeded under the mock's exact name`);
      assert.ok(sportSchema.safeParse(row).success, mock.name);
      assert.equal(row.is_gym, mock.is_gym === 1, mock.name);
      assert.equal(row.generation_enabled, mock.availability === 'working', mock.name);
      if (!row.is_gym) {
        const duration = row.metrics.find((metric) => metric.key === 'duration_minutes');
        assert.deepEqual(
          { ...duration, label: 'Time' },
          {
            key: 'duration_minutes',
            label: 'Time',
            unit: 'min',
            type: 'number',
            required: true,
            minimum: 1,
          },
          mock.name,
        );
      }
    }
    assert.deepEqual(
      first.filter((sport) => sport.generation_enabled).map((sport) => sport.name),
      ['Walking', 'Strength', 'Running', 'Cycling', 'Swimming', 'Mobility', 'Football'],
    );

    assert.deepEqual(
      (await db.query('SELECT id::text FROM public.profile ORDER BY id')).rows.map((row) => row.id),
      [earlyUser, laterUser],
    );
    await assert.rejects(
      db.exec("INSERT INTO public.sport (name) VALUES ('RUNNING')"),
      /sport_name_lower_key/,
    );
  } finally {
    await db.close();
  }
});
