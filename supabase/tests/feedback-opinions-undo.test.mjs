import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { activityOpinionSchema, apiSchemas } from '../../packages/contracts/src/product.ts';
import { createDatabase } from './database.mjs';

const migrations = [
  '20261003130000_profile_sport_workout_baseline.sql',
  '20261003140000_product_persistence.sql',
  '20261004100000_feedback_opinions_undo.sql',
].map((file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));

const owner = '00000000-0000-4000-8000-000000000501';
const otherOwner = '00000000-0000-4000-8000-000000000502';
const walkId = '00000000-0000-4000-8000-000000000601';
const jogId = '00000000-0000-4000-8000-000000000602';
const meta = (requestId = null) => ({ contract_version: '1', request_id: requestId });
const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

const activity = (id, title, startAt, minutes = 20) => ({
  id,
  sport_id: '1',
  title,
  description: 'A gentle session at your own pace.',
  start_at: startAt,
  duration_minutes: minutes,
  gym_exercises: [],
});
const walk = activity(walkId, 'Easy walk', '2026-10-05T09:00:00+02:00');
const jog = activity(jogId, 'Gentle jog', '2026-10-07T09:00:00+02:00');
const week = (activities) => ({
  week_start: '2026-10-05',
  timezone: 'Europe/Warsaw',
  activities,
});

const savePlan = async (db, args) =>
  (
    await db.query(
      `SELECT public.save_plan_version(
        $1::uuid, $2::uuid, $3::int, $4::uuid, $5::text, $6::jsonb, $7::text, NULL, $8::jsonb
      ) AS result`,
      [
        owner,
        args.planId ?? null,
        args.expected,
        args.requestId,
        args.origin,
        JSON.stringify(args.plan),
        args.summary ?? 'Saved.',
        args.input ? JSON.stringify(args.input) : null,
      ],
    )
  ).rows[0].result;
const completeSql = `SELECT public.complete_activity(
  $1::uuid, $2::uuid, $3::uuid, $4::jsonb, '[]'::jsonb, $5::jsonb, $6::timestamptz
) AS result`;
const feedbackSql = 'SELECT public.update_completion_feedback($1::uuid, $2::jsonb) AS result';
const expectCode = async (promise, code) => {
  await assert.rejects(promise, (error) => {
    assert.match(error.message, new RegExp(code));
    return true;
  });
};
const as = async (db, role, subject = null) => {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [subject ?? '']);
  await db.exec(`SET ROLE ${role}`);
};

async function prepare() {
  const db = await createDatabase();
  for (const migration of migrations) await db.exec(migration);
  await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
    owner,
    'owner@example.test',
    otherOwner,
    'other@example.test',
  ]);
  await db.exec(`INSERT INTO public.sport (id, name, is_gym, generation_enabled, metrics)
    OVERRIDING SYSTEM VALUE VALUES (1, 'Walking', false, true,
    '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]')`);
  return db;
}

test('a log can be saved before feedback, and only its owner can change the feedback', async () => {
  const db = await prepare();
  try {
    await as(db, 'service_role');
    const plan = await savePlan(db, {
      expected: 0,
      requestId: uuid(701),
      origin: 'generate',
      plan: week([walk, jog]),
    });
    await as(db, 'authenticated', owner);
    const completedAt = new Date(Date.now() - 60_000).toISOString();
    const metrics = JSON.stringify({ duration_minutes: 20 });
    const args = [plan.version.id, walkId, uuid(702), metrics, null, completedAt];
    const logged = (await db.query(completeSql, args)).rows[0].result;
    assert.equal(logged.feedback, null);
    assert.ok(
      apiSchemas.CompletionResponse.safeParse({ data: logged, meta: meta(uuid(702)) }).success,
    );
    // A transport retry replays the same saved log.
    assert.deepEqual((await db.query(completeSql, args)).rows[0].result, logged);
    // JSON null from the Data API means the same as SQL NULL.
    const jsonNull = (
      await db.query(completeSql, [plan.version.id, jogId, uuid(703), metrics, 'null', completedAt])
    ).rows[0].result;
    assert.equal(jsonNull.feedback, null);
    await expectCode(
      db.query(completeSql, [
        plan.version.id,
        jogId,
        uuid(704),
        metrics,
        JSON.stringify({ effort: 'fine', enjoyment: null, notes: '' }),
        completedAt,
      ]),
      'INVALID_REQUEST',
    );

    const feedback = { effort: 'hard', enjoyment: 'maybe', notes: 'Windy.' };
    const updated = (await db.query(feedbackSql, [logged.id, JSON.stringify(feedback)])).rows[0]
      .result;
    assert.deepEqual(updated.feedback, feedback);
    assert.deepEqual({ ...updated, feedback: null }, logged);
    assert.ok(apiSchemas.CompletionResponse.safeParse({ data: updated, meta: meta() }).success);
    const changed = { effort: 'okay', enjoyment: null, notes: '' };
    assert.deepEqual(
      (await db.query(feedbackSql, [logged.id, JSON.stringify(changed)])).rows[0].result.feedback,
      changed,
    );
    for (const invalid of [
      null,
      'null',
      JSON.stringify({ effort: 'okay', notes: '' }),
      JSON.stringify({ ...changed, extra: true }),
      JSON.stringify({ ...changed, enjoyment: 'often' }),
      JSON.stringify({ ...changed, notes: 'x'.repeat(1001) }),
    ])
      await expectCode(db.query(feedbackSql, [logged.id, invalid]), 'INVALID_REQUEST');
    await expectCode(db.query(feedbackSql, [uuid(799), JSON.stringify(changed)]), 'NOT_FOUND');
    await assert.rejects(
      db.query('UPDATE public.activity_completion SET feedback = NULL WHERE id = $1', [logged.id]),
      /permission denied/,
    );

    await as(db, 'authenticated', otherOwner);
    await expectCode(db.query(feedbackSql, [logged.id, JSON.stringify(feedback)]), 'NOT_FOUND');
    await as(db, 'anon');
    await assert.rejects(
      db.query(feedbackSql, [logged.id, JSON.stringify(feedback)]),
      /permission denied for function update_completion_feedback/,
    );
    await as(db, 'service_role');
    await assert.rejects(
      db.query(feedbackSql, [logged.id, JSON.stringify(feedback)]),
      /permission denied for function update_completion_feedback/,
    );
    await db.exec('RESET ROLE');
    assert.deepEqual(
      (await db.query('SELECT feedback FROM public.activity_completion WHERE id = $1', [logged.id]))
        .rows[0].feedback,
      changed,
    );
  } finally {
    await db.close();
  }
});

test('opinions are private to their owner and can be saved, cleared and reset', async () => {
  const db = await prepare();
  const upsert = `INSERT INTO public.activity_opinion
      (profile_id, activity_key, title, sport_id, opinion, last_date)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (profile_id, activity_key) DO UPDATE SET
      title = EXCLUDED.title, sport_id = EXCLUDED.sport_id,
      opinion = EXCLUDED.opinion, last_date = EXCLUDED.last_date
    RETURNING activity_key, title, sport_id::text, opinion, last_date::text, updated_at`;
  const asJson = (row) => JSON.parse(JSON.stringify(row));
  const count = async (subject) =>
    (
      await db.query(
        'SELECT count(*)::int AS count FROM public.activity_opinion WHERE profile_id = $1',
        [subject],
      )
    ).rows[0].count;
  try {
    assert.equal(
      (
        await db.query(
          "SELECT has_table_privilege('anon', 'public.activity_opinion', 'SELECT') AS granted",
        )
      ).rows[0].granted,
      false,
    );
    await as(db, 'authenticated', owner);
    const first = asJson(
      (await db.query(upsert, [owner, 'easy-walk', 'Easy walk', 1, 'yes', '2026-10-05'])).rows[0],
    );
    assert.ok(activityOpinionSchema.safeParse(first).success);
    assert.ok(apiSchemas.OpinionListResponse.safeParse({ data: [first], meta: meta() }).success);
    const second = asJson(
      (await db.query(upsert, [owner, 'easy-walk', 'Easy walk', 1, 'no', '2026-10-12'])).rows[0],
    );
    assert.equal(second.opinion, 'no');
    assert.equal(second.last_date, '2026-10-12');
    assert.ok(Date.parse(second.updated_at) >= Date.parse(first.updated_at));
    await db.query(upsert, [owner, 'gentle-jog', 'Gentle jog', 1, 'maybe', '2026-10-07']);
    assert.equal(await count(owner), 2);

    for (const [values, pattern] of [
      [[owner, 'Easy Walk', 'Easy walk', 1, 'yes', '2026-10-05'], /check constraint/],
      [[owner, 'easy-walk', 'Easy walk', 1, 'often', '2026-10-05'], /check constraint/],
      [[owner, 'easy-walk', '   ', 1, 'yes', '2026-10-05'], /check constraint/],
      [[owner, 'easy-walk', 'Easy walk', 99, 'yes', '2026-10-05'], /foreign key constraint/],
    ])
      await assert.rejects(db.query(upsert, values), pattern);

    await as(db, 'authenticated', otherOwner);
    assert.deepEqual((await db.query('SELECT * FROM public.activity_opinion')).rows, []);
    await assert.rejects(
      db.query(upsert, [owner, 'sneaky', 'Sneaky', 1, 'yes', '2026-10-05']),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query("UPDATE public.activity_opinion SET opinion = 'yes' WHERE profile_id = $1", [
          owner,
        ])
      ).affectedRows,
      0,
    );
    assert.equal(
      (await db.query('DELETE FROM public.activity_opinion WHERE profile_id = $1', [owner]))
        .affectedRows,
      0,
    );
    // The same activity key is independent per account.
    await db.query(upsert, [otherOwner, 'easy-walk', 'Easy walk', 1, 'yes', '2026-10-05']);
    await as(db, 'anon');
    await assert.rejects(db.query('SELECT * FROM public.activity_opinion'), /permission denied/);

    await as(db, 'authenticated', owner);
    // Clearing one opinion, then resetting the rest, never touches the other account.
    assert.equal(
      (
        await db.query(
          "DELETE FROM public.activity_opinion WHERE profile_id = $1 AND activity_key = 'gentle-jog' RETURNING activity_key",
          [owner],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          'DELETE FROM public.activity_opinion WHERE profile_id = $1 RETURNING activity_key',
          [owner],
        )
      ).rows.length,
      1,
    );
    await db.exec('RESET ROLE');
    assert.equal(await count(owner), 0);
    assert.equal(await count(otherOwner), 1);
    await db.query('DELETE FROM auth.users WHERE id = $1', [otherOwner]);
    assert.equal(await count(otherOwner), 0);
  } finally {
    await db.close();
  }
});

test('plan versions accept the undo origin and still protect logged sessions', async () => {
  const db = await prepare();
  try {
    await as(db, 'service_role');
    const first = await savePlan(db, {
      expected: 0,
      requestId: uuid(801),
      origin: 'generate',
      plan: week([walk, jog]),
    });
    const shorterJog = { ...jog, duration_minutes: 15 };
    const revised = await savePlan(db, {
      planId: first.plan.id,
      expected: 1,
      requestId: uuid(802),
      origin: 'revise',
      plan: week([walk, shorterJog]),
    });
    const undoInput = { request_id: uuid(803), plan_id: first.plan.id, expected_version: 2 };
    const undo = {
      planId: first.plan.id,
      expected: 2,
      requestId: uuid(803),
      origin: 'undo',
      plan: first.version.plan,
      summary: 'The last change was undone.',
      input: undoInput,
    };
    const undone = await savePlan(db, undo);
    assert.equal(undone.version.version, 3);
    assert.equal(undone.version.origin, 'undo');
    assert.deepEqual(undone.version.plan, first.version.plan);
    assert.ok(
      apiSchemas.UndoPlanResponse.safeParse({ data: undone, meta: meta(uuid(803)) }).success,
    );
    assert.ok(
      apiSchemas.PlanHistoryResponse.safeParse({
        data: [undone.version, revised.version, first.version],
        meta: meta(),
      }).success,
    );
    // A transport retry replays the same Undo.
    assert.deepEqual(await savePlan(db, undo), undone);
    await expectCode(
      savePlan(db, { ...undo, input: { ...undoInput, expected_version: 1 } }),
      'REQUEST_CONFLICT',
    );
    await expectCode(
      savePlan(db, { ...undo, requestId: uuid(804), origin: 'restore', expected: 3 }),
      'INVALID_REQUEST',
    );
    await expectCode(
      savePlan(db, { ...undo, requestId: uuid(805), planId: null, expected: 0 }),
      'VERSION_CONFLICT',
    );

    await as(db, 'authenticated', owner);
    await db.query(completeSql, [
      undone.version.id,
      jogId,
      uuid(806),
      JSON.stringify({ duration_minutes: 20 }),
      null,
      new Date(Date.now() - 60_000).toISOString(),
    ]);
    // The database independently refuses to change a logged session, Undo included.
    await as(db, 'service_role');
    await expectCode(
      savePlan(db, {
        planId: first.plan.id,
        expected: 3,
        requestId: uuid(807),
        origin: 'undo',
        plan: revised.version.plan,
      }),
      'COMPLETED_ACTIVITY_LOCKED',
    );
    await db.exec('RESET ROLE');
    await assert.rejects(
      db.query(
        `INSERT INTO public.plan_version (plan_id, profile_id, version, origin, "plan", summary)
         VALUES ($1, $2, 9, 'restore', $3, 'Invalid origin')`,
        [first.plan.id, owner, JSON.stringify(first.version.plan)],
      ),
      /plan_version_origin_check/,
    );
  } finally {
    await db.close();
  }
});
