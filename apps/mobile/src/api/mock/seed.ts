/**
 * The demo data: Ana (ana@example.com, any password of 8+ characters) with the
 * design's story laid over the last three weeks, so it always reads as recent
 * (design/README.md › Demo persona). Her first plan was two weeks ago; a chat
 * change moved Friday to the morning and shortened it, then she skipped it; a
 * football game went in through chat; weekly plans followed. In the current
 * week, sessions before today are done, today's and later ones are planned.
 * Google sign-in maps to Sam, a new account with no answers (onboarding).
 */
import {
  addDays,
  atLocalTime,
  formatWeekRange,
  startOfWeek,
  toIsoWithOffset,
  toLocalDate,
  weekdayIndex,
} from '../../lib/dates';
import { SAMPLE_PREFS } from '../../lib/preference-options';
import type { ActivityLog, ChatMessage, ChooseAgain, Felt, LocalDate, PlannedSession } from '../types';
import { activityKey, emptyDb, emptyUserData, nextId, type MockDb, type UserData } from './model';
import { asNewIdea, workoutFor, type TemplateKey } from './templates';
import { GOOGLE_EMAIL } from './backend';
import { describeWeekPlan } from './planner';

export const DEMO_EMAIL = 'ana@example.com';
export const DEMO_PASSWORD = 'movo-demo';

interface Done {
  felt: Felt;
  again: ChooseAgain | null;
  note?: string;
  km?: number;
  file?: string;
}

export function seedDb(now: Date): MockDb {
  const db = emptyDb();
  const today = toLocalDate(now);
  const w0 = startOfWeek(today);
  const w1 = addDays(w0, -7);
  const w2 = addDays(w0, -14);
  const iso = (date: LocalDate, h: number, m = 0) => toIsoWithOffset(atLocalTime(date, h, m));
  const prefs = SAMPLE_PREFS;

  const ana = { id: 'user_ana', email: DEMO_EMAIL, name: 'Ana', provider: 'email' as const, created_at: iso(w2, 6, 40) };
  const sam = { id: 'user_sam', email: GOOGLE_EMAIL, name: 'Sam', provider: 'google' as const, created_at: toIsoWithOffset(now) };
  db.accounts.push({ user: ana, password: DEMO_PASSWORD }, { user: sam, password: null });
  db.users[sam.id] = emptyUserData();

  const u: UserData = emptyUserData();
  u.preferences = { ...prefs };
  db.users[ana.id] = u;

  const session = (
    date: LocalDate,
    hour: number,
    key: TemplateKey,
    minutes: number,
    version: number,
    optional = false,
  ): PlannedSession => {
    const base = workoutFor(key, minutes, prefs);
    const w = optional ? asNewIdea(base) : base;
    return {
      id: nextId(db, 's'),
      sport_id: w.sport_id,
      title: w.title,
      time_slot: { start: iso(date, hour), duration: minutes * 60 },
      description: w.description,
      status: 'planned',
      editable: true,
      plan_version: version,
      optional,
      changed_in_version: null,
      log_id: null,
      ...w.details,
    };
  };

  /** Mark a session done with a log and its feedback. */
  const complete = (s: PlannedSession, done: Done): PlannedSession => {
    const start = new Date(s.time_slot.start);
    const end = new Date(start.getTime() + s.time_slot.duration * 1000 + 10 * 60_000);
    const log: ActivityLog = {
      id: nextId(db, 'log'),
      session_id: s.id,
      sport_id: s.sport_id,
      title: s.title,
      started_at: s.time_slot.start,
      duration_seconds: s.time_slot.duration,
      source: done.file ? 'file' : 'typed',
      file_name: done.file ?? null,
      metrics: { duration: s.time_slot.duration, ...(done.km ? { distance: done.km } : {}) },
      sets: [],
      ended_early: false,
      extra: false,
      feedback: {
        felt: done.felt,
        note: done.note ?? null,
        choose_again: done.again,
        created_at: toIsoWithOffset(end),
      },
      created_at: toIsoWithOffset(end),
    };
    u.logs.push(log);
    if (done.again) {
      const key = activityKey(s.title);
      u.opinions = [
        ...u.opinions.filter((o) => o.activity_key !== key),
        {
          activity_key: key,
          title: s.title,
          sport_id: s.sport_id,
          opinion: done.again,
          last_date: toLocalDate(s.time_slot.start),
          new_idea: s.optional,
        },
      ];
    }
    u.summary_at = log.created_at;
    return { ...s, status: 'completed', log_id: log.id };
  };

  /* Week 1: the first plan (version 1), then the chat change on Wednesday evening (version 2). */
  const mon1 = complete(session(w2, 7, 'brisk_walk', 20, 1), { felt: 'easy', again: 'yes', km: 1.8 });
  const wed1 = complete(session(addDays(w2, 2), 7, 'walk_run', 20, 1), {
    felt: 'just_right',
    again: 'yes',
    km: 2.3,
    note: 'The runs went quicker than I expected.',
  });
  const friPlanned = session(addDays(w2, 4), 18, 'walk_run', 20, 1);
  u.versions.push({
    version: 1,
    created_at: iso(w2, 6, 52),
    source: 'first_plan',
    summary: 'Built from your answers: walk and run, three days a week, 20 minutes, between 7:00 and 11:00.',
    chat_message_id: null,
    snapshot: [{ ...mon1, status: 'planned', log_id: null }, { ...wed1, status: 'planned', log_id: null }, friPlanned],
  });

  const ask: ChatMessage = {
    id: nextId(db, 'msg'),
    created_at: iso(addDays(w2, 2), 20, 13),
    role: 'user',
    kind: 'text',
    text: 'Can we keep everything to mornings this week, and make Friday shorter?',
    about: null,
  };
  const changeId = nextId(db, 'msg');
  const friChanged: PlannedSession = {
    ...session(addDays(w2, 4), 7, 'walk_run', 10, 2),
    id: friPlanned.id,
    changed_in_version: 2,
  };
  const summary2 = 'All your sessions are at 7:00 now, and Friday is 10 minutes.';
  u.versions.push({
    version: 2,
    created_at: iso(addDays(w2, 2), 20, 14),
    source: 'chat',
    summary: summary2,
    chat_message_id: changeId,
    snapshot: [friChanged],
  });
  u.changes.push({ message_id: changeId, before: [friPlanned], added_ids: [] });
  const changeCard: ChatMessage = {
    id: changeId,
    created_at: iso(addDays(w2, 2), 20, 14),
    role: 'coach',
    kind: 'change',
    change: {
      from_version: 1,
      to_version: 2,
      summary: summary2,
      sport_switch: null,
      rows: [
        {
          kind: 'changed',
          session_id: friPlanned.id,
          date: addDays(w2, 4),
          title: 'Walk-run intervals',
          was_title: null,
          sport_id: 'running',
          diffs: [
            { field: 'time', from: '18:00', to: '7:00' },
            { field: 'duration', from: 1200, to: 600 },
          ],
          note: 'Three runs instead of six.',
        },
      ],
      not_changed: [],
      kept: 'Monday and Wednesday stay as you did them.',
      can_undo: false,
      undone: false,
    },
  };

  /* Thursday evening: football with friends, added in chat (8.16). Friday was skipped later. */
  const football: ActivityLog = {
    id: nextId(db, 'log'),
    session_id: null,
    sport_id: 'football',
    title: 'Football',
    started_at: iso(addDays(w2, 3), 19, 30),
    duration_seconds: 3600,
    source: 'chat',
    file_name: null,
    metrics: { duration: 3600 },
    sets: [],
    ended_early: false,
    extra: true,
    feedback: null,
    created_at: iso(addDays(w2, 3), 21, 10),
  };
  u.logs.push(football);
  u.chat.push(ask, changeCard, {
    id: nextId(db, 'msg'),
    created_at: iso(addDays(w2, 3), 21, 9),
    role: 'user',
    kind: 'text',
    text: 'Played football with friends tonight, about an hour',
    about: null,
  });
  u.chat.push({
    id: nextId(db, 'msg'),
    created_at: football.created_at,
    role: 'coach',
    kind: 'workout_logged',
    log: football,
    can_undo: false,
    undone: false,
  });
  const fri1: PlannedSession = { ...friChanged, status: 'skipped' };

  /* Week 2 (version 3, planned on Sunday): walk-run, an optional stretch, an easy walk. All done. */
  const week2 = [
    complete(session(w1, 7, 'walk_run', 20, 3), { felt: 'just_right', again: 'yes', km: 2.4, file: 'morning-run.fit' }),
    complete(session(addDays(w1, 3), 7, 'stretching', 20, 3, true), { felt: 'easy', again: 'maybe' }),
    complete(session(addDays(w1, 5), 7, 'easy_walk', 20, 3), {
      felt: 'easy',
      again: 'yes',
      km: 1.6,
      note: 'A nice way to end the week.',
    }),
  ];
  u.versions.push({
    version: 3,
    created_at: iso(addDays(w1, -1), 19, 5),
    source: 'weekly_plan',
    summary: `Week 2, ${formatWeekRange(w1)}: ${describeWeekPlan(week2)}`,
    chat_message_id: null,
    snapshot: week2.map((s) => ({ ...s, status: 'planned', log_id: null })),
  });

  /* Week 3, this week (version 4): a walk-run, a brisk walk and a walk-run, with today one of
     them, and a hill walk to try. Days before today are done. */
  const t = weekdayIndex(today);
  const mainDays = t <= 1 ? [t, t + 2, t + 4] : t >= 4 ? [t - 4, t - 2, t] : [t - 2, t, t + 2];
  const keys: TemplateKey[] = ['walk_run', 'brisk_walk', 'walk_run'];
  const freeAfter = [0, 1, 2, 3, 4, 5, 6].filter((d) => !mainDays.includes(d) && d > t);
  const hillDay = t - 1 >= 0 && !mainDays.includes(t - 1) ? t - 1 : (freeAfter[freeAfter.length - 1] ?? null);
  const planned3 = [
    ...mainDays.map((d, i) => session(addDays(w0, d), 7, keys[i], 20, 4)),
    ...(hillDay !== null ? [session(addDays(w0, hillDay), 7, 'hill_walk', 20, 4, true)] : []),
  ].sort((a, b) => a.time_slot.start.localeCompare(b.time_slot.start));
  const FEEDBACK: Record<string, Done> = {
    'Walk-run intervals': { felt: 'just_right', again: 'yes', km: 2.4 },
    'Brisk walk': { felt: 'easy', again: 'yes', km: 1.9 },
    'Hill walk': { felt: 'hard', again: 'no', km: 1.7, note: 'The hill was steeper than I expected.' },
  };
  const week3 = planned3.map((s) =>
    toLocalDate(s.time_slot.start) < today ? complete(s, FEEDBACK[s.title] ?? { felt: 'just_right', again: null }) : s,
  );
  u.versions.push({
    version: 4,
    created_at: iso(addDays(w0, -1), 19, 2),
    source: 'weekly_plan',
    summary: `Week 3, ${formatWeekRange(w0)}: ${describeWeekPlan(planned3)}`,
    chat_message_id: null,
    snapshot: planned3,
  });

  u.sessions = [mon1, wed1, fri1, ...week2, ...week3];
  u.plan = {
    status: 'ready',
    active_version: 4,
    first_week_start: w2,
    planned_through: addDays(w0, 6),
    failure_message: null,
    recent_change: null,
    build: null,
  };
  return db;
}
