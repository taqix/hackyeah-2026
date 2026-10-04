import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { apiSchemas, updateProfileSchema } from '../../packages/contracts/src/product.ts';
import { createDatabase } from './database.mjs';

const read = (file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
const earlier = [
  '20261003130000_profile_sport_workout_baseline.sql',
  '20261003140000_product_persistence.sql',
  '20261004100000_feedback_opinions_undo.sql',
  '20261004110000_sport_catalog_seed.sql',
].map(read);
const migration = read('20261004120000_profile_username_from_auth.sql');

let next = 0;
const userId = () => `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`;
const google = (name) => ({
  iss: 'https://accounts.google.com',
  sub: '100000000000000000001',
  name,
  full_name: name,
  email: 'person@example.test',
  picture: 'https://example.test/avatar.png',
  avatar_url: 'https://example.test/avatar.png',
  provider_id: '100000000000000000001',
  email_verified: true,
  phone_verified: false,
});

async function migrated(before = async () => {}) {
  const db = await createDatabase();
  for (const sql of earlier) await db.exec(sql);
  await before(db);
  await db.exec(migration);
  return db;
}
const signUp = async (db, metadata, id = userId()) => {
  await db.query(
    'INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)',
    [id, `${id}@example.test`, metadata === undefined ? null : JSON.stringify(metadata)],
  );
  return id;
};
const refreshMetadata = (db, id, metadata) =>
  db.query('UPDATE auth.users SET raw_user_meta_data = $2::jsonb WHERE id = $1', [
    id,
    JSON.stringify(metadata),
  ]);
const profile = async (db, id) => {
  const [row] = (
    await db.query(
      'SELECT id, username, created_at, preferences FROM public.profile WHERE id = $1',
      [id],
    )
  ).rows;
  // Data API/Postgres JSON transport uses timestamp strings, not JS Date instances.
  return row && JSON.parse(JSON.stringify(row));
};
const username = async (db, id) => (await profile(db, id)).username;

/** What GET /profile checks before answering, and what PUT /profile accepts back. */
function assertContractUsername(row) {
  const response = apiSchemas.ProfileResponse.safeParse({
    data: row,
    meta: { contract_version: '1', request_id: null },
  });
  assert.ok(response.success, JSON.stringify(response.error?.issues));
  // Already trimmed by the contract's rules, so it round-trips unchanged.
  assert.equal(response.data.data.username, row.username);
  assert.ok(
    updateProfileSchema.shape.username.safeParse(row.username).success,
    'the stored name can be sent back in PUT /profile',
  );
}

test('signup copies a cleaned name from Google or email sign-up metadata', async () => {
  const db = await migrated();
  try {
    const cases = [
      [google('Ada Lovelace'), 'Ada Lovelace'],
      // The app's email sign-up sends {name, full_name}.
      [{ name: '  Grace \t  Hopper\n', full_name: '  Grace \t  Hopper\n' }, 'Grace Hopper'],
      [{ name: 'Name', full_name: 'Full Name', given_name: 'Given' }, 'Name'],
      [{ full_name: 'Full Name', given_name: 'Given' }, 'Full Name'],
      [{ given_name: 'Given' }, 'Given'],
      // A blank or non-text name falls through to the next key.
      [{ name: ' \u00a0\u3000 ', full_name: 'Fallback Name' }, 'Fallback Name'],
      [{ name: 42, full_name: { first: 'Ada' }, given_name: 'Ada' }, 'Ada'],
      // Unicode spaces and control characters collapse to one space.
      [{ name: '\ufeff\u2003José\u00a0\u2028María\u0007Núñez\u3000' }, 'José María Núñez'],
      [{ name: 'Zoë 李 😀' }, 'Zoë 李 😀'],
    ];
    for (const [metadata, expected] of cases) {
      const id = await signUp(db, metadata);
      const row = await profile(db, id);
      assert.equal(row.username, expected, JSON.stringify(metadata));
      assertContractUsername(row);
    }
  } finally {
    await db.close();
  }
});

test('signup leaves the username empty when the metadata has no usable name', async () => {
  const db = await migrated();
  try {
    for (const metadata of [
      undefined,
      {},
      [],
      'Ada',
      { name: '' },
      { name: '   ' },
      { name: '\t\n\r\u00a0\u1680\u2000\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\u0085' },
      { name: null, full_name: false, given_name: ['Ada'] },
      { email: 'person@example.test', avatar_url: 'https://example.test/a.png' },
    ]) {
      const id = await signUp(db, metadata);
      const row = await profile(db, id);
      assert.equal(row.username, null, JSON.stringify(metadata));
      assertContractUsername(row);
    }
  } finally {
    await db.close();
  }
});

test('very long names are cut to the contract maximum in UTF-16 code units', async () => {
  const db = await migrated();
  try {
    const cases = [
      ['A'.repeat(500), 'A'.repeat(200)],
      // Characters outside the BMP count twice in JavaScript's length.
      ['😀'.repeat(150), '😀'.repeat(100)],
      [`a${'😀'.repeat(150)}`, `a${'😀'.repeat(99)}`],
      // A cut that ends on a space is trimmed again.
      [`${'x'.repeat(199)} yz`, 'x'.repeat(199)],
      [`  ${'Long Name '.repeat(40)}`, 'Long Name '.repeat(20).trimEnd()],
    ];
    for (const [name, expected] of cases) {
      const id = await signUp(db, google(name));
      const row = await profile(db, id);
      assert.equal(row.username, expected);
      assert.ok(row.username.length <= 200);
      assertContractUsername(row);
    }
  } finally {
    await db.close();
  }
});

test('later metadata fills only an empty username and never replaces a chosen one', async () => {
  const db = await migrated();
  try {
    // An account whose sign-up carried no name gets one when Google refreshes its metadata.
    const unnamed = await signUp(db, {});
    await refreshMetadata(db, unnamed, google('Ada Lovelace'));
    assert.equal(await username(db, unnamed), 'Ada Lovelace');
    assertContractUsername(await profile(db, unnamed));

    // A name from sign-up, or one changed in the app, survives later Google refreshes.
    const named = await signUp(db, { name: 'Grace', full_name: 'Grace' });
    await refreshMetadata(db, named, google('Grace Brewster Hopper'));
    assert.equal(await username(db, named), 'Grace');
    await db.query("UPDATE public.profile SET username = 'Amazing Grace' WHERE id = $1", [named]);
    await refreshMetadata(db, named, google('G. Hopper'));
    assert.equal(await username(db, named), 'Amazing Grace');

    // Metadata without a usable name, and updates of other columns, change nothing.
    const blank = await signUp(db, {});
    await refreshMetadata(db, blank, { name: '   ' });
    await db.query("UPDATE auth.users SET email = 'changed@example.test' WHERE id = $1", [blank]);
    assert.equal(await username(db, blank), null);
  } finally {
    await db.close();
  }
});

test('a failing name lookup never blocks signing up or signing in', async () => {
  const db = await migrated();
  try {
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.profile_username_from_metadata(p_metadata jsonb)
      RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $function$
      BEGIN
        RAISE EXCEPTION 'name lookup failed';
      END;
      $function$;
    `);
    const id = await signUp(db, google('Ada Lovelace'));
    assert.equal(await username(db, id), null);
    await refreshMetadata(db, id, google('Ada King'));
    assert.equal(await username(db, id), null);

    // Reapplying the migration restores the helper, and the backfill names the profile.
    await db.exec(migration);
    assert.equal(await username(db, id), 'Ada King');
  } finally {
    await db.close();
  }
});

test('the migration backfills empty usernames, keeps chosen ones and is safe to reapply', async () => {
  const unnamedGoogle = userId();
  const chosen = userId();
  const blank = userId();
  const noProfile = userId();
  const db = await migrated(async (db) => {
    // Accounts created under the previous trigger have profiles without a username.
    await signUp(db, google('  Ada   Lovelace '), unnamedGoogle);
    await signUp(db, google('Google Name'), chosen);
    await db.query("UPDATE public.profile SET username = 'Chosen' WHERE id = $1", [chosen]);
    await signUp(db, { email: 'blank@example.test' }, blank);
    await db.exec('ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created');
    await signUp(db, google('No Profile'), noProfile);
    await db.exec('ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created');
  });
  try {
    assert.equal(await username(db, unnamedGoogle), 'Ada Lovelace');
    assertContractUsername(await profile(db, unnamedGoogle));
    assert.equal(await username(db, chosen), 'Chosen');
    assert.equal(await username(db, blank), null);
    // The backfill only names existing profiles; it does not create them.
    assert.equal(await profile(db, noProfile), undefined);

    await db.query("UPDATE public.profile SET username = 'Renamed' WHERE id = $1", [unnamedGoogle]);
    await db.exec(migration);
    assert.equal(await username(db, unnamedGoogle), 'Renamed');
    assert.equal(await username(db, chosen), 'Chosen');
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM pg_trigger WHERE tgname = 'on_auth_user_metadata_updated'",
        )
      ).rows[0].count,
      1,
    );

    // A signup that meets an existing profile row updates the email, fills only an empty name.
    await db.exec(`
      CREATE TABLE auth.users_replay (LIKE auth.users);
      CREATE TRIGGER replay_signup AFTER INSERT ON auth.users_replay
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `);
    await db.query(
      `INSERT INTO auth.users_replay (id, email, raw_user_meta_data)
       VALUES ($1, 'chosen@example.test', $3::jsonb), ($2, 'blank@example.test', $4::jsonb)`,
      [chosen, blank, JSON.stringify(google('Replayed')), JSON.stringify(google('Filled'))],
    );
    assert.deepEqual(
      (
        await db.query(
          'SELECT email, username FROM public.profile WHERE id IN ($1, $2) ORDER BY id',
          [chosen, blank],
        )
      ).rows,
      [
        { email: 'chosen@example.test', username: 'Chosen' },
        { email: 'blank@example.test', username: 'Filled' },
      ],
    );
  } finally {
    await db.close();
  }
});

test('clients cannot call the name helper or the signup trigger functions', async () => {
  const db = await migrated();
  try {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(
        db.query(`SELECT public.profile_username_from_metadata('{"name":"Ada"}'::jsonb)`),
        /permission denied for function profile_username_from_metadata/,
        role,
      );
      await assert.rejects(
        db.query('SELECT public.handle_user_metadata_update()'),
        /permission denied for function handle_user_metadata_update/,
        role,
      );
      await assert.rejects(
        db.query('SELECT public.handle_new_user()'),
        /permission denied for function handle_new_user/,
        role,
      );
      await db.exec('RESET ROLE');
    }
    const security = (
      await db.query(
        `SELECT proname, prosecdef, proconfig FROM pg_proc
         WHERE pronamespace = 'public'::regnamespace
           AND proname IN ('profile_username_from_metadata', 'handle_new_user', 'handle_user_metadata_update')
         ORDER BY proname`,
      )
    ).rows;
    assert.deepEqual(security, [
      { proname: 'handle_new_user', prosecdef: true, proconfig: ['search_path=""'] },
      { proname: 'handle_user_metadata_update', prosecdef: true, proconfig: ['search_path=""'] },
      {
        proname: 'profile_username_from_metadata',
        prosecdef: false,
        proconfig: ['search_path=""'],
      },
    ]);
  } finally {
    await db.close();
  }
});
