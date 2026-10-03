import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createDatabase } from './database.mjs';

const baseline = readFileSync(
  new URL('../migrations/20261003130000_profile_sport_workout_baseline.sql', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL('../migrations/20261003140000_product_persistence.sql', import.meta.url),
  'utf8',
);

const owner = '00000000-0000-4000-8000-000000000101';
const otherOwner = '00000000-0000-4000-8000-000000000102';
const activityId = '00000000-0000-4000-8000-000000000201';
const secondActivityId = '00000000-0000-4000-8000-000000000202';
const request = '00000000-0000-4000-8000-000000000301';
const completionRequest = '00000000-0000-4000-8000-000000000302';

const activity = (id, title = 'Easy walk') => ({
  id,
  sport_id: '1',
  title,
  description: 'A gentle beginner session',
  start_at: '2026-10-05T09:00:00+02:00',
  duration_minutes: 20,
  gym_exercises: [],
});
const gymActivity = (id = '00000000-0000-4000-8000-000000000203') => ({
  id,
  sport_id: '2',
  title: 'Beginner strength',
  description: 'A gentle strength session',
  start_at: '2026-10-06T09:00:00+02:00',
  duration_minutes: 20,
  gym_exercises: [{ id: 'squat', name: 'Squat', sets: [{ repetitions: 8 }] }],
});
const planDocument = (activities, weekStart = '2026-10-05') => ({
  week_start: weekStart,
  timezone: 'Europe/Warsaw',
  activities,
});
const savePlanSql = `SELECT public.save_plan_version(
  $1::uuid, $2::uuid, $3::int, $4::uuid, $5::text, $6::jsonb, $7::text, $8::text, $9::jsonb
) AS result`;
const savePlan = async (db, args) =>
  (
    await db.query(savePlanSql, [
      args.owner,
      args.planId,
      args.expected,
      args.requestId,
      args.origin,
      JSON.stringify(args.plan),
      args.summary,
      args.message ?? null,
      args.input == null ? null : JSON.stringify(args.input),
    ])
  ).rows[0].result;
const expectCode = async (promise, code) => {
  await assert.rejects(promise, (error) => {
    assert.match(error.message, new RegExp(code));
    return true;
  });
};

test('owner cascade deletes chat and completion history while direct version deletion stays blocked', async () => {
  const db = await createDatabase();
  try {
    await db.exec(baseline);
    await db.exec(migration);
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
      owner,
      'owner@example.test',
    ]);
    const planId = '00000000-0000-4000-8000-000000000401';
    const versionId = '00000000-0000-4000-8000-000000000402';
    await db.query(
      'INSERT INTO public.plan (id, profile_id, active_version_id) VALUES ($1, $2, NULL)',
      [planId, owner],
    );
    await db.query(
      `INSERT INTO public.plan_version (id, plan_id, profile_id, version, origin, "plan", summary)
       VALUES ($1, $2, $3, 1, 'generate', $4, 'A plan')`,
      [versionId, planId, owner, JSON.stringify(planDocument([activity(activityId)]))],
    );
    await db.query('UPDATE public.plan SET active_version_id = $1 WHERE id = $2', [
      versionId,
      planId,
    ]);
    await db.query(
      `INSERT INTO public.activity_completion (profile_id, plan_version_id, activity_id, feedback, request_id)
       VALUES ($1, $2, $3, '{"effort":"okay","enjoyment":"yes","notes":""}', $4)`,
      [owner, versionId, activityId, completionRequest],
    );
    await db.query(
      `INSERT INTO public.chat_message (profile_id, plan_id, "role", content, outcome, plan_version_id, request_id)
       VALUES ($1, $2, 'assistant', 'Plan saved', 'plan_updated', $3, $4)`,
      [owner, planId, versionId, request],
    );
    await assert.rejects(
      db.query('DELETE FROM public.plan_version WHERE id = $1', [versionId]),
      /foreign key constraint/,
    );
    await assert.rejects(
      db.query('DELETE FROM public.plan WHERE id = $1', [planId]),
      /foreign key constraint/,
    );
    await db.query('DELETE FROM auth.users WHERE id = $1', [owner]);
    for (const table of [
      'profile',
      'plan',
      'plan_version',
      'chat_message',
      'activity_completion',
    ]) {
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS count FROM public.${table} WHERE ${table === 'profile' ? 'id' : 'profile_id'} = $1`,
            [owner],
          )
        ).rows[0].count,
        0,
        `${table} rows should be deleted with the owner`,
      );
    }
  } finally {
    await db.close();
  }
});

test('product RPCs preserve owner/version/completion invariants and enforce least privilege', async () => {
  const db = await createDatabase();
  try {
    await db.exec(baseline);
    await db.exec(migration);
    assert.equal(
      (await db.query("SELECT has_table_privilege('anon', 'public.plan', 'SELECT') AS granted"))
        .rows[0].granted,
      false,
    );
    assert.equal(
      (
        await db.query(
          "SELECT has_table_privilege('authenticated', 'public.plan', 'INSERT') AS granted",
        )
      ).rows[0].granted,
      false,
    );
    assert.equal(
      (
        await db.query(
          "SELECT has_table_privilege('authenticated', 'public.product_request_receipt', 'SELECT') AS granted",
        )
      ).rows[0].granted,
      false,
    );
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      owner,
      'owner@example.test',
      otherOwner,
      'other@example.test',
    ]);
    await db.exec(`INSERT INTO public.sport (id, name, is_gym, generation_enabled, metrics)
      OVERRIDING SYSTEM VALUE VALUES
      (1, 'Walking', false, true, '[{"key":"duration_minutes","label":"Duration","unit":"min","type":"number","required":true,"minimum":0},{"key":"mood","label":"Mood","unit":null,"type":"text","required":false}]'),
      (2, 'Gym', true, true, '[]')`);

    await db.exec('SET ROLE service_role');
    await expectCode(
      savePlan(db, {
        owner,
        planId: null,
        expected: 0,
        requestId: '00000000-0000-4000-8000-000000000310',
        origin: 'generate',
        plan: {
          week_start: '2026-10-05',
          timezone: 'Europe/Warsaw',
          activities: [{ id: activityId }],
        },
        summary: 'Invalid initial plan',
      }),
      'INVALID_REQUEST',
    );
    assert.equal(
      (
        await db.query('SELECT count(*)::int AS count FROM public.plan WHERE profile_id = $1', [
          owner,
        ])
      ).rows[0].count,
      0,
    );
    const firstPlan = planDocument([activity(activityId), gymActivity()]);
    const inputDto = {
      intent: 'Create my beginner plan',
      week_start: '2026-10-05',
    };
    const created = await savePlan(db, {
      owner,
      planId: null,
      expected: 0,
      requestId: request,
      origin: 'generate',
      plan: firstPlan,
      summary: 'Start gently',
      message: 'Please make me a plan',
      input: inputDto,
    });
    assert.equal(created.version.version, 1);
    assert.equal(created.version.origin, 'generate');
    assert.equal(created.plan.active_version_id, created.version.id);

    const retry = await savePlan(db, {
      owner,
      planId: null,
      expected: 0,
      requestId: request,
      origin: 'generate',
      plan: planDocument([activity(activityId, 'Nondeterministic retry output'), gymActivity()]),
      summary: 'Different generated summary',
      message: 'Please make me a plan',
      input: inputDto,
    });
    assert.deepEqual(retry, created);
    await expectCode(
      savePlan(db, {
        owner,
        planId: null,
        expected: 0,
        requestId: request,
        origin: 'generate',
        plan: planDocument([activity(activityId, 'Changed'), gymActivity()]),
        summary: 'Start gently',
        message: 'Please make me a plan',
        input: { ...inputDto, intent: 'Different request' },
      }),
      'REQUEST_CONFLICT',
    );

    await expectCode(
      savePlan(db, {
        owner,
        planId: created.plan.id,
        expected: 0,
        requestId: '00000000-0000-4000-8000-000000000303',
        origin: 'revise',
        plan: firstPlan,
        summary: 'Stale save',
      }),
      'VERSION_CONFLICT',
    );
    await expectCode(
      savePlan(db, {
        owner: otherOwner,
        planId: created.plan.id,
        expected: 1,
        requestId: '00000000-0000-4000-8000-000000000304',
        origin: 'revise',
        plan: firstPlan,
        summary: 'Cross-owner save',
      }),
      'NOT_FOUND',
    );

    const replyId = '00000000-0000-4000-8000-000000000305';
    const chatSql = `SELECT public.save_chat_reply($1, $2, $3, $4, $5, $6, $7, $8) AS result`;
    const chatInput = {
      message: 'Can I ask a question?',
      plan_id: created.plan.id,
    };
    const chatArgs = [
      owner,
      created.plan.id,
      1,
      replyId,
      'Can I ask a question?',
      'Of course.',
      'reply',
      JSON.stringify(chatInput),
    ];
    const chat = (await db.query(chatSql, chatArgs)).rows[0].result;
    assert.equal(chat.messages.length, 2);
    assert.deepEqual((await db.query(chatSql, chatArgs)).rows[0].result, chat);
    assert.deepEqual(
      (
        await db.query(chatSql, [
          ...chatArgs.slice(0, 5),
          'Nondeterministic retry answer',
          'reply',
          JSON.stringify(chatInput),
        ])
      ).rows[0].result,
      chat,
    );
    await expectCode(
      db.query(chatSql, [
        ...chatArgs.slice(0, 5),
        'Changed answer',
        'reply',
        JSON.stringify({ ...chatInput, message: 'Changed original input' }),
      ]),
      'REQUEST_CONFLICT',
    );
    await expectCode(
      db.query(chatSql, [
        owner,
        created.plan.id,
        1,
        request,
        'A different operation',
        'Okay',
        'reply',
        JSON.stringify({ message: 'A different operation' }),
      ]),
      'REQUEST_CONFLICT',
    );
    await db.exec('RESET ROLE');

    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}';`);
    const completionArgs = [
      created.version.id,
      activityId,
      completionRequest,
      JSON.stringify({ duration_minutes: 20, mood: 'good' }),
      JSON.stringify([]),
      JSON.stringify({ effort: 'too_much', enjoyment: null, notes: '' }),
      new Date(Date.now() - 60_000).toISOString(),
    ];
    const completeSql = `SELECT public.complete_activity($1, $2, $3, $4, $5, $6, $7) AS result`;
    const completion = (await db.query(completeSql, completionArgs)).rows[0].result;
    assert.equal(completion.activity_id, activityId);
    assert.equal(completion.feedback.effort, 'too_much');
    assert.equal(completion.feedback.enjoyment, null);
    assert.deepEqual((await db.query(completeSql, completionArgs)).rows[0].result, completion);
    await expectCode(
      db.query(completeSql, [
        completionArgs[0],
        completionArgs[1],
        '00000000-0000-4000-8000-000000000311',
        completionArgs[3],
        JSON.stringify([{ exercise_id: 'squat', sets: [{ repetitions: 8, weight_kg: null }] }]),
        completionArgs[5],
        completionArgs[6],
      ]),
      'INVALID_REQUEST',
    );
    await expectCode(
      db.query(completeSql, [
        completionArgs[0],
        completionArgs[1],
        '00000000-0000-4000-8000-000000000319',
        JSON.stringify({ duration_minutes: 20, 'Mood!': 'good' }),
        completionArgs[4],
        completionArgs[5],
        completionArgs[6],
      ]),
      'INVALID_REQUEST',
    );
    await expectCode(
      db.query(completeSql, [
        completionArgs[0],
        completionArgs[1],
        '00000000-0000-4000-8000-000000000312',
        completionArgs[3],
        JSON.stringify([{ exercise_id: 'squat', sets: [{ repetitions: 8 }] }]),
        completionArgs[5],
        completionArgs[6],
      ]),
      'INVALID_REQUEST',
    );
    await expectCode(
      db.query(completeSql, [
        completionArgs[0],
        completionArgs[1],
        '00000000-0000-4000-8000-000000000313',
        JSON.stringify({ duration_minutes: 20, unsupported: 'nope' }),
        completionArgs[4],
        completionArgs[5],
        completionArgs[6],
      ]),
      'INVALID_REQUEST',
    );
    await expectCode(
      db.query(completeSql, [
        completionArgs[0],
        completionArgs[1],
        '00000000-0000-4000-8000-000000000314',
        JSON.stringify({ duration_minutes: 20, mood: 4 }),
        completionArgs[4],
        completionArgs[5],
        completionArgs[6],
      ]),
      'INVALID_REQUEST',
    );
    await expectCode(
      db.query(completeSql, [
        completionArgs[0],
        completionArgs[1],
        '00000000-0000-4000-8000-000000000315',
        completionArgs[3],
        completionArgs[4],
        JSON.stringify({
          effort: 'okay',
          enjoyment: 'yes',
          notes: '',
          extra: true,
        }),
        completionArgs[6],
      ]),
      'INVALID_REQUEST',
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM public.activity_completion WHERE profile_id = $1',
          [owner],
        )
      ).rows[0].count,
      1,
    );

    const gymActivityId = '00000000-0000-4000-8000-000000000203';
    const gymArgs = [
      created.version.id,
      gymActivityId,
      '00000000-0000-4000-8000-000000000316',
      JSON.stringify({}),
      JSON.stringify([{ exercise_id: 'squat', sets: [{ repetitions: 8, weight_kg: null }] }]),
      JSON.stringify({ effort: 'okay', enjoyment: 'yes', notes: '' }),
      completionArgs[6],
    ];
    const gymCompletion = (await db.query(completeSql, gymArgs)).rows[0].result;
    assert.equal(gymCompletion.activity_id, gymActivityId);
    await expectCode(
      db.query(completeSql, [...gymArgs.slice(0, 2), replyId, ...gymArgs.slice(3)]),
      'REQUEST_CONFLICT',
    );
    await expectCode(
      db.query(completeSql, [
        ...gymArgs.slice(0, 2),
        '00000000-0000-4000-8000-000000000317',
        gymArgs[3],
        JSON.stringify([{ exercise_id: 'bench', sets: [{ repetitions: 8, weight_kg: null }] }]),
        ...gymArgs.slice(5),
      ]),
      'INVALID_REQUEST',
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM public.activity_completion WHERE profile_id = $1',
          [owner],
        )
      ).rows[0].count,
      2,
    );
    await expectCode(
      db.query(completeSql, [
        completionArgs[0],
        completionArgs[1],
        '00000000-0000-4000-8000-000000000318',
        JSON.stringify({ mood: 'good' }),
        completionArgs[4],
        completionArgs[5],
        completionArgs[6],
      ]),
      'INVALID_REQUEST',
    );
    const invalidFeedback = JSON.stringify({ enjoyment: 'yes', notes: '' });
    await expectCode(
      db.query(completeSql, [...completionArgs.slice(0, 5), invalidFeedback, completionArgs[6]]),
      'INVALID_REQUEST',
    );
    await expectCode(
      db.query(completeSql, [...completionArgs.slice(0, 6), 'infinity']),
      'INVALID_REQUEST',
    );
    await expectCode(
      db.query(completeSql, [
        ...completionArgs.slice(0, 6),
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      ]),
      'INVALID_REQUEST',
    );
    await assert.rejects(
      db.query(
        "INSERT INTO public.plan_version(plan_id,profile_id,version,origin,\"plan\",summary) VALUES ($1,$2,99,'revise',$3,'direct')",
        [created.plan.id, owner, JSON.stringify(firstPlan)],
      ),
      /permission denied/,
    );
    await expectCode(
      db.query(completeSql, [
        ...completionArgs.slice(0, 2),
        '00000000-0000-4000-8000-000000000306',
        ...completionArgs.slice(3),
      ]),
      'ALREADY_COMPLETED',
    );

    await db.exec('RESET ROLE; SET ROLE service_role');
    const sameWeekPlan = planDocument([
      activity(activityId),
      gymActivity(),
      activity(secondActivityId, 'Easy cycle'),
    ]);
    const revised = await savePlan(db, {
      owner,
      planId: created.plan.id,
      expected: 1,
      requestId: '00000000-0000-4000-8000-000000000307',
      origin: 'revise',
      plan: sameWeekPlan,
      summary: 'Added an option',
    });
    assert.equal(revised.version.version, 2);
    await expectCode(
      savePlan(db, {
        owner,
        planId: created.plan.id,
        expected: 2,
        requestId: '00000000-0000-4000-8000-000000000308',
        origin: 'revise',
        plan: planDocument([activity(activityId, 'Changed completed session')]),
        summary: 'Changed completed activity',
      }),
      'COMPLETED_ACTIVITY_LOCKED',
    );

    const nextWeek = await savePlan(db, {
      owner,
      planId: created.plan.id,
      expected: 2,
      requestId: '00000000-0000-4000-8000-000000000309',
      origin: 'generate',
      plan: planDocument([activity(secondActivityId, 'Next week walk')], '2026-10-12'),
      summary: 'Next week plan',
    });
    assert.deepEqual(
      nextWeek.version.plan.activities.map((item) => item.id),
      [secondActivityId],
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM public.activity_completion WHERE profile_id = $1',
          [owner],
        )
      ).rows[0].count,
      2,
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM public.plan_version WHERE profile_id = $1',
          [owner],
        )
      ).rows[0].count,
      3,
    );
    await db.exec('RESET ROLE');

    await expectCode(
      db.query('DELETE FROM public.plan_version WHERE id = $1', [created.version.id]),
      'foreign key constraint',
    );
    await expectCode(
      db.query('DELETE FROM public.plan WHERE id = $1', [created.plan.id]),
      'foreign key constraint',
    );

    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${otherOwner}';`);
    assert.deepEqual((await db.query('SELECT id FROM public.plan')).rows, []);
    assert.deepEqual((await db.query('SELECT id FROM public.plan_version')).rows, []);
    assert.deepEqual((await db.query('SELECT id FROM public.activity_completion')).rows, []);
    assert.deepEqual((await db.query('SELECT id FROM public.chat_message')).rows, []);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.plan'), /permission denied/);
    await assert.rejects(
      db.query('SELECT public.save_plan_version(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)'),
      /permission denied for function save_plan_version/,
    );
    await db.exec('RESET ROLE');

    await db.query('DELETE FROM auth.users WHERE id = $1', [owner]);
    for (const table of [
      'profile',
      'plan',
      'plan_version',
      'chat_message',
      'activity_completion',
      'product_request_receipt',
    ]) {
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS count FROM public.${table} WHERE ${table === 'profile' ? 'id' : 'profile_id'} = $1`,
            [owner],
          )
        ).rows[0].count,
        0,
        `${table} rows should be deleted with the owner`,
      );
    }
  } finally {
    await db.close();
  }
});
