import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { apiSchemas, profileSchema, sportSchema } from '../../packages/contracts/src/product.ts';
import { completion, generation, owner, preferences, snapshot, sports } from './fixtures.ts';
import { createDatabase } from './database.mjs';

test('persisted SQL results satisfy the frontend contracts, including nullable feedback and a quiet week', async () => {
  const db = await createDatabase();
  const meta = { contract_version: '1', request_id: generation.request_id };
  try {
    for (const file of [
      '20261003130000_profile_sport_workout_baseline.sql',
      '20261003140000_product_persistence.sql',
    ])
      await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
      owner,
      'demo@example.test',
    ]);
    const initial = (
      await db.query(
        'SELECT id, username, created_at, preferences FROM public.profile WHERE id=$1',
        [owner],
      )
    ).rows[0];
    // Data API/Postgres JSON transport uses timestamp strings, not JS Date instances.
    const initialJson = JSON.parse(JSON.stringify(initial));
    assert.ok(profileSchema.safeParse(initialJson).success);
    assert.equal(initialJson.preferences, null);
    await db.query('UPDATE public.profile SET preferences=$2::jsonb WHERE id=$1', [
      owner,
      JSON.stringify(preferences),
    ]);
    await db.query(
      "INSERT INTO public.sport (id, name, is_gym, generation_enabled, metrics) VALUES (1, 'Running', false, true, $1::jsonb)",
      [JSON.stringify(sports[0].metrics)],
    );
    const catalog = (
      await db.query('SELECT id::text, name, is_gym, generation_enabled, metrics FROM public.sport')
    ).rows;
    assert.ok(sportSchema.safeParse(catalog[0]).success);
    await db.exec('SET ROLE service_role');
    const saved = (
      await db.query(
        `SELECT public.save_plan_version(
      $1::uuid, NULL, 0, $2::uuid, 'generate', $3::jsonb, 'Ready.', NULL, $4::jsonb
    ) AS result`,
        [owner, generation.request_id, JSON.stringify(snapshot), JSON.stringify(generation)],
      )
    ).rows[0].result;
    assert.ok(apiSchemas.GeneratePlanResponse.safeParse({ data: saved, meta }).success);
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [owner]);
    await db.exec('SET ROLE authenticated');
    const actuals = {
      ...completion,
      plan_version_id: saved.version.id,
      request_id: '00000000-0000-4000-8000-000000000090',
      completed_at: new Date(Date.now() - 60000).toISOString(),
      feedback: { effort: 'too_much', enjoyment: null, notes: 'Stopped early.' },
    };
    apiSchemas.CompleteActivityDto.parse(actuals);
    const recorded = (
      await db.query(
        `SELECT public.complete_activity(
      $1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb, $6::jsonb, $7::timestamptz
    ) AS result`,
        [
          actuals.plan_version_id,
          actuals.activity_id,
          actuals.request_id,
          JSON.stringify(actuals.metrics),
          JSON.stringify(actuals.gym_log),
          JSON.stringify(actuals.feedback),
          actuals.completed_at,
        ],
      )
    ).rows[0].result;
    assert.ok(
      apiSchemas.CompletionResponse.safeParse({
        data: recorded,
        meta: { ...meta, request_id: actuals.request_id },
      }).success,
    );
    assert.equal(recorded.feedback.enjoyment, null);
    await db.exec('RESET ROLE; SET ROLE service_role');
    const quiet = { ...snapshot, week_start: '2026-10-12', activities: [] };
    const next = (
      await db.query(
        `SELECT public.save_plan_version(
      $1::uuid, $2::uuid, 1, $3::uuid, 'generate', $4::jsonb, 'A quiet week.', NULL, $5::jsonb
    ) AS result`,
        [
          owner,
          saved.plan.id,
          '00000000-0000-4000-8000-000000000091',
          JSON.stringify(quiet),
          JSON.stringify({
            ...generation,
            expected_version: 1,
            sport_id: null,
            week_start: quiet.week_start,
          }),
        ],
      )
    ).rows[0].result;
    assert.ok(apiSchemas.CurrentPlanResponse.safeParse({ data: next, meta }).success);
    assert.deepEqual(next.version.plan.activities, []);
    assert.equal(
      (await db.query('SELECT count(*)::int AS count FROM public.activity_completion')).rows[0]
        .count,
      1,
    );
  } finally {
    await db.close();
  }
});
