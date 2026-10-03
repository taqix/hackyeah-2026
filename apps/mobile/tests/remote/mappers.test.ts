import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activityKey,
  feedbackFromWire,
  feedbackToWire,
  gymLogToWire,
  logFromCompletion,
  logFromDraft,
  metricsToWire,
  preferencesFromWire,
  preferencesToWire,
  sessionFromActivity,
  sportFromWire,
} from '../../src/api/remote/mappers';
import type { Draft } from '../../src/api/remote/drafts';
import type { LoggedSet, Preferences } from '../../src/api/types';
import { activity, completion, gymActivity, SPORTS, version } from './fakes';

const slugs: Record<string, string> = { '1': 'walking', '2': 'strength', '3': 'running', '9': 'tennis' };
const toApp = (wireId: string) => slugs[wireId] ?? `sport-${wireId}`;
const toWire = (appId: string) =>
  Object.entries(slugs).find(([, slug]) => slug === appId)?.[0] ?? (/^sport-(\d+)$/.exec(appId)?.[1] ?? null);

const PREFS: Preferences = {
  timezone: 'Europe/Warsaw',
  starting_comfort: 'starting_out',
  sessions_per_week: 3,
  session_minutes: 20,
  preferred_window: [7, 10],
  activity_interests: ['walking', 'running', 'sport-42'],
  discovery_preference: 'occasional',
  available_locations: ['outdoors', 'home'],
  available_equipment: ['mat'],
  avoidances: ['jumping'],
  starting_obstacles: ['time'],
  excluded_activity_types: ['tennis'],
};

test('preferences survive a round trip through the wire shape', () => {
  const wire = preferencesToWire(PREFS, toWire);
  assert.deepEqual(wire.preferred_window, { start_hour: 7, end_hour: 10 });
  assert.deepEqual(wire.activity_interests, ['1', '3', '42']);
  assert.deepEqual(wire.excluded_activity_types, ['9']);
  assert.deepEqual(Object.keys(wire).sort(), Object.keys(PREFS).sort(), 'exactly the contract keys');
  assert.deepEqual(preferencesFromWire(wire, toApp), PREFS);
  assert.equal(preferencesToWire({ ...PREFS, preferred_window: null }, toWire).preferred_window, null);
});

test('sports the catalog lacks are dropped, and no interest left means explore', () => {
  const wire = preferencesToWire({ ...PREFS, activity_interests: ['yoga', 'yoga'], excluded_activity_types: ['boxing'] }, toWire);
  assert.deepEqual(wire.activity_interests, []);
  assert.equal(wire.discovery_preference, 'explore');
  assert.deepEqual(wire.excluded_activity_types, []);
});

test('catalog rows become app sports, enriched from the library by name', () => {
  const walking = sportFromWire(SPORTS[0], toApp);
  assert.equal(walking.id, 'walking');
  assert.equal(walking.availability, 'working');
  assert.equal(walking.suggested, true);
  assert.match(walking.description, /own pace/);
  assert.ok(walking.is_gym === 0);
  if (walking.is_gym === 0) {
    const [duration, distance, route] = walking.metrics;
    assert.deepEqual(duration, {
      key: 'duration_minutes',
      description: 'Time',
      required: true,
      value_schema: { type: 'integer', minimum: 1 },
      unit: 'min',
      represents_session_duration: true,
    });
    assert.deepEqual(distance.value_schema, { type: 'number', minimum: 0 });
    assert.equal(distance.represents_session_duration, undefined);
    assert.deepEqual(route.value_schema, { type: 'string', maxLength: 200 });
    assert.equal(route.unit, undefined);
  }

  const strength = sportFromWire(SPORTS[1], toApp);
  assert.ok(strength.is_gym === 1 && strength.exercises?.some((e) => e.id === 'goblet_squat'));
  assert.equal(sportFromWire(SPORTS[2], toApp).id, 'running', 'names match case-insensitively, trimmed');

  const tennis = sportFromWire(SPORTS[3], toApp);
  assert.equal(tennis.availability, 'preview');
  assert.equal(tennis.suggested, undefined);

  const unknown = sportFromWire(SPORTS[4], toApp);
  assert.equal(unknown.id, 'sport-42');
  assert.equal(unknown.description, '');
});

test('feedback maps just_right to okay and a missing note to an empty string, and back', () => {
  const wire = feedbackToWire({ felt: 'just_right', note: null, choose_again: 'maybe' });
  assert.deepEqual(wire, { effort: 'okay', enjoyment: 'maybe', notes: '' });
  assert.deepEqual(feedbackFromWire(wire, '2026-10-05T07:30:00+02:00'), {
    felt: 'just_right',
    note: null,
    choose_again: 'maybe',
    created_at: '2026-10-05T07:30:00+02:00',
  });
  assert.equal(feedbackToWire({ felt: 'hard', note: ' Windy ', choose_again: null }).notes, 'Windy');
  assert.equal(feedbackFromWire(null, 'x'), null);
  assert.equal(activityKey('Walk–run intervals!'), 'walk-run-intervals');
  assert.match(activityKey('a'.repeat(150)), /^[a-z0-9][a-z0-9_-]{0,99}$/);
});

test('metrics: duration seconds become whole minutes, unknown and invalid values are dropped', () => {
  const walking = SPORTS[0];
  assert.deepEqual(
    metricsToWire({ duration_minutes: 1500, distance_km: 2.4, route: '  Park loop ', indoor: true, extra: 3 }, walking),
    { duration_minutes: 25, distance_km: 2.4, route: 'Park loop' },
  );
  assert.deepEqual(metricsToWire({ distance_km: -1, route: '   ' }, walking, 600), { duration_minutes: 10 });
  assert.deepEqual(metricsToWire({ distance_km: '3.5', route: 'x'.repeat(250) }, walking), {
    distance_km: 3.5,
    route: 'x'.repeat(200),
  });
  assert.deepEqual(metricsToWire({ duration_minutes: 20 }, walking), { duration_minutes: 1 }, 'never 0 minutes');
});

test('gym sets are grouped per planned exercise in plan order; others are dropped', () => {
  const gym = gymActivity(1);
  const set = (exercise_id: string | null, exercise_name: string, set_index: number, reps: number | null, weight_kg: number | null = null): LoggedSet => ({
    exercise_id,
    exercise_name,
    set_index,
    reps,
    weight_kg,
    seconds: null,
  });
  const log = gymLogToWire(
    [
      set('wall_push_up', 'Wall push-up', 1, 7),
      set('chair_squat', 'Chair squat', 0, 10, 4),
      set('wall_push_up', 'Wall push-up', 0, 8),
      set(null, 'chair squat', 1, 120, 2000),
      set('leg_press', 'Leg press', 0, 10, 40),
      set(null, 'Plank', 0, null),
    ],
    gym,
  );
  assert.deepEqual(log, [
    { exercise_id: 'chair_squat', sets: [{ repetitions: 10, weight_kg: 4 }, { repetitions: 100, weight_kg: 1000 }] },
    { exercise_id: 'wall_push_up', sets: [{ repetitions: 8, weight_kg: null }, { repetitions: 7, weight_kg: null }] },
  ]);
  assert.deepEqual(gymLogToWire([], gym), []);
});

test('an activity becomes a session: planned and editable in the future, done with a completion or draft', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  const walk = activity(1);
  const v2 = version(2, '2026-10-05', [walk]);
  const planned = sessionFromActivity(walk, v2, { now, toAppSportId: toApp });
  assert.deepEqual(planned, {
    id: walk.id,
    sport_id: 'walking',
    title: walk.title,
    description: walk.description,
    time_slot: { start: walk.start_at, duration: 1200 },
    status: 'planned',
    editable: true,
    plan_version: 2,
    optional: false,
    changed_in_version: null,
    log_id: null,
    metrics: {},
    parts: [],
  });
  const past = sessionFromActivity(walk, v2, { now: new Date('2026-10-06T00:00:00Z'), toAppSportId: toApp });
  assert.equal(past.editable, false);

  const done = sessionFromActivity(walk, v2, { now, toAppSportId: toApp, completion: completion(1, walk, v2) });
  assert.equal(done.status, 'completed');
  assert.equal(done.editable, false);
  assert.equal(done.log_id, completion(1, walk, v2).id);

  const drafted = sessionFromActivity(walk, v2, { now, toAppSportId: toApp, draft: { id: 'draft:abc' } as Draft });
  assert.equal(drafted.status, 'completed');
  assert.equal(drafted.log_id, 'draft:abc');

  const gym = sessionFromActivity(gymActivity(2), v2, { now, toAppSportId: toApp });
  assert.ok('exercises' in gym);
  if ('exercises' in gym) {
    assert.deepEqual(gym.exercises[0], {
      name: 'Chair squat',
      exercise_id: 'chair_squat',
      sets: 2,
      repetitions: 10,
      description: 'Sit down onto a chair slowly, then stand up again without using your hands.',
    });
  }
});

test('a completion becomes a log: duration from the metric, start before completed_at, sets named from the plan', () => {
  const walk = activity(1);
  const v1 = version(1, '2026-10-05', [walk]);
  const log = logFromCompletion(completion(1, walk, v1), walk, toApp);
  assert.equal(log.session_id, walk.id);
  assert.equal(log.sport_id, 'walking');
  assert.equal(log.title, walk.title);
  assert.equal(log.duration_seconds, 1500);
  assert.equal(Date.parse(log.started_at), Date.parse('2026-10-05T07:05:00+02:00'));
  assert.deepEqual(log.metrics, { duration_minutes: 1500 });
  assert.equal(log.source, 'typed');
  assert.equal(log.extra, false);
  assert.equal(log.actuals_locked, true);
  assert.deepEqual(log.feedback, { felt: 'just_right', note: null, choose_again: 'yes', created_at: '2026-10-05T07:30:00+02:00' });

  const noDuration = logFromCompletion(completion(2, walk, v1, { metrics: {}, feedback: null }), walk, toApp);
  assert.equal(noDuration.duration_seconds, 1200, 'the planned length');
  assert.equal(noDuration.feedback, null);

  const gym = gymActivity(3);
  const gymLog = logFromCompletion(
    completion(3, gym, v1, { gym_log: [{ exercise_id: 'chair_squat', sets: [{ repetitions: 10, weight_kg: null }, { repetitions: 9, weight_kg: 2 }] }] }),
    gym,
    toApp,
  );
  assert.deepEqual(gymLog.sets.map((s) => [s.exercise_name, s.set_index, s.reps, s.weight_kg]), [
    ['Chair squat', 0, 10, null],
    ['Chair squat', 1, 9, 2],
  ]);
  assert.equal(gymLog.ended_early, true, 'two of four planned sets');
});

test('a draft reads as an unsaved log', () => {
  const draft: Draft = {
    id: 'draft:1',
    request_id: 'r',
    activity_id: 'a',
    plan_version_id: 'v',
    sport_id: 'walking',
    title: 'Easy walk',
    started_at: '2026-10-05T07:00:00+02:00',
    duration_seconds: 900,
    source: 'file',
    file_name: 'walk.gpx',
    metrics: { duration_minutes: 900 },
    sets: [],
    ended_early: false,
    created_at: '2026-10-05T07:20:00+02:00',
    submission: null,
  };
  const log = logFromDraft(draft);
  assert.equal(log.id, 'draft:1');
  assert.equal(log.session_id, 'a');
  assert.equal(log.file_name, 'walk.gpx');
  assert.equal(log.feedback, null);
  assert.equal(log.actuals_locked, false);
});
