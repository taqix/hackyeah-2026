/**
 * The mock coach: design/prototype/chat.jsx coach() ported to real sessions.
 * Keywords pick the reply; the real backend gets validated revisions from the
 * Gemini modify mode instead. A change never touches done, skipped or started
 * sessions, and anything it can't do comes back with the reason (8.7, 8.10).
 *
 * Chat screens: send "Move it" with the missed session attached for Home's
 * Move it (8.15); the coach answers with free slots and "Skip it this time".
 */
import {
  addDays,
  atLocalTime,
  capitalize,
  formatClock,
  formatDayLong,
  formatTime,
  joinAnd,
  minutesOfDay,
  numberWord,
  relativeDayName,
  startOfWeek,
  toIsoWithOffset,
  toLocalDate,
  weekdayIndex,
} from '../../lib/dates';
import { sessionLocalDate, sessionMinutes, sessionStart, sortSessions } from '../../lib/sessions';
import type {
  ChangeDiff,
  ChangeRow,
  LocalDate,
  PlannedSession,
  Preferences,
  SportDefinition,
} from '../types';
import type { PendingCoach, WorkoutDraft } from './model';
import { plannable, slotFor } from './planner';
import {
  asNewIdea,
  canDo,
  nounOf,
  templateForSport,
  templateOf,
  walkRunCount,
  withWorkout,
  workoutFor,
  type TemplateKey,
} from './templates';

export interface CoachInput {
  text: string;
  now: Date;
  prefs: Preferences;
  catalog: SportDefinition[];
  /** Every session (history and plan). */
  sessions: PlannedSession[];
  planned_through: LocalDate | null;
  /** The session attached to the message. */
  about: PlannedSession | null;
  pending: PendingCoach | null;
  /** This exact text failed before, so a resend goes through (the "fail" keyword fails once). */
  retry: boolean;
  newId: () => string;
}

export interface CoachReply {
  kind: 'reply';
  text: string;
  quick_replies: string[];
  quiet_option: { label: string; note: string | null } | null;
  foot: 'plan_unchanged' | 'nothing_saved';
  pending: PendingCoach | null;
}

export interface CoachLog {
  kind: 'log';
  sport_id: string;
  title: string;
  date: LocalDate;
  minutes: number;
  distance: number | null;
  evening: boolean;
}

export interface CoachChange {
  kind: 'change';
  summary: string;
  sport_switch: { from: string; to: string } | null;
  rows: ChangeRow[];
  not_changed: { title: string; reason: string }[];
  kept: string;
  /** New states of existing sessions (removed ones are skipped). */
  updated: PlannedSession[];
  /** Sessions the change creates. */
  added: PlannedSession[];
}

export type CoachResult = { kind: 'fail' } | CoachReply | CoachLog | CoachChange;

/* ------------------------------------------------------------- Copy */

const HEALTH =
  "Plans can't take pain or health conditions into account yet. If it keeps hurting, check with a doctor or physio. Resting is always okay.";
const WINDOW_REASON = 'Sessions are planned between 7:00 and 21:00.';
const LENGTH_REASON = 'Sessions are 5, 10 or 20 minutes long.';
/** Chat's length snapping keeps the contract's lengths (README › Onboarding preferences). */
const LENGTHS = [5, 10, 20];

/* ---------------------------------------------------------- Reading */

const DONE_WORDS = /\b(played|ran|swam|walked|cycled|biked|rode|hiked|jogged|did|went for|went to)\b/;
const SPORT_WORDS: [title: string, sportId: string, pattern: RegExp][] = [
  ['Football', 'football', /football|soccer/],
  ['Swim', 'swimming', /\bsw[ia]m|\bpool\b/],
  ['Bike ride', 'cycling', /\bbik(e|ed)\b|\bcycl|\brode\b/],
  ['Run', 'running', /\bran\b|\bruns?\b|\bjog/],
  ['Walk', 'walking', /\bwalk|\bhik(e|ed)\b/],
  ['Yoga', 'yoga', /yoga/],
  ['Stretching', 'mobility', /stretch/],
  ['Tennis', 'tennis', /tennis/],
  ['Gym', 'strength', /\bgym\b|weights|dumbbell/],
];
/** Catalog sports by the words people use for a switch. */
const SWITCH_WORDS: [sportId: string, pattern: RegExp][] = [
  ['strength', /\bgym\b|\bstrength\b|\bweights\b/],
  ['running', /\brun(ning|s)?\b|\bjog/],
  ['walking', /\bwalk(ing|s)?\b/],
  ['swimming', /\bswim(ming)?\b/],
  ['cycling', /\bbik(e|ing)\b|\bcycl/],
  ['mobility', /\bstretch|\bmobility\b/],
  ['yoga', /\byoga\b/],
  ['football', /\bfootball\b|\bsoccer\b/],
  ['tennis', /\btennis\b/],
  ['pilates', /\bpilates\b/],
  ['boxing', /\bboxing\b/],
  ['climbing', /\bclimbing\b/],
  ['dancing', /\bdanc/],
];
const OTHER_SPORTS = /kitesurf\w*|skydiv\w*|surfing|fencing|polo|golf|skiing|snowboard\w*|squash|karate|judo|rugby|cricket|crossfit|archery/;
const WEEKDAY_WORDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Minutes in "about an hour", "45 min", "1.5 h". */
export function minutesIn(s: string): number | null {
  if (/an hour and a half|one and a half hours?/.test(s)) return 90;
  if (/half an hour|half hour/.test(s)) return 30;
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)\b/);
  if (m) return Math.round(Number(m[1]) * 60);
  if (/\ban hour\b|\bone hour\b/.test(s)) return 60;
  m = s.match(/(\d+)\s*(?:min|mins|minutes?)\b/);
  return m ? Number(m[1]) : null;
}

function sportIn(s: string): [string, string] | null {
  const hit = SPORT_WORDS.find(([, , re]) => re.test(s));
  return hit ? [hit[0], hit[1]] : null;
}

/** "I played football yesterday for an hour" as a workout draft. */
export function readWorkout(s: string, today: LocalDate, pending: WorkoutDraft | null): WorkoutDraft {
  const sport = sportIn(s);
  const base: WorkoutDraft = pending ?? {
    sport_id: null,
    title: null,
    date: today,
    minutes: null,
    distance: null,
    evening: false,
  };
  const km = s.match(/(\d+(?:\.\d+)?)\s*(?:km|kilomet\w*)\b/);
  const metres = s.match(/(\d+)\s*(?:m|metres|meters)\b/);
  const sportId = sport?.[1] ?? base.sport_id;
  let distance = base.distance;
  if (sportId === 'swimming') distance = metres ? Number(metres[1]) : km ? Math.round(Number(km[1]) * 1000) : distance;
  else if (km) distance = Number(km[1]);
  let date = base.date;
  if (/yesterday/.test(s)) date = addDays(today, -1);
  else {
    const day = WEEKDAY_WORDS.findIndex((w) => new RegExp(`\\b(on )?${w}\\b`).test(s));
    if (day >= 0) {
      const back = (weekdayIndex(today) - day + 7) % 7;
      date = addDays(today, -back);
    }
  }
  return {
    sport_id: sportId,
    title: sport?.[0] ?? base.title,
    date,
    minutes: minutesIn(s) ?? base.minutes,
    distance,
    evening: base.evening || /tonight|this evening|\bevening\b/.test(s),
  };
}

/** "at 6", "at 18:30", "at 7pm": minutes since midnight. */
function timeIn(s: string): { minutes: number; early: boolean; text: string } | null {
  const m = s.match(/\bat (\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'pm' && hour < 12) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return { minutes: hour * 60 + minute, early: hour < 7, text: formatClock(hour * 60 + minute) };
}

interface Mention {
  /** For a session: the weekday; resolved per use. */
  weekday: number | null;
  /** today / tomorrow / yesterday as a fixed date. */
  date: LocalDate | null;
  at: number;
}

function dayMentions(s: string, today: LocalDate): Mention[] {
  const found: Mention[] = [];
  WEEKDAY_WORDS.forEach((w, i) => {
    const at = s.search(new RegExp(`\\b${w}\\b`));
    if (at >= 0) found.push({ weekday: i, date: null, at });
  });
  const fixed: [RegExp, number][] = [
    [/\btoday\b|\btonight\b|\bthis (morning|evening|afternoon)\b/, 0],
    [/\btomorrow\b/, 1],
    [/\byesterday\b/, -1],
  ];
  for (const [re, offset] of fixed) {
    const at = s.search(re);
    if (at >= 0) found.push({ weekday: null, date: addDays(today, offset), at });
  }
  return found.sort((a, b) => a.at - b.at);
}

/* ---------------------------------------------------------- Helpers */

const reply = (
  text: string,
  quick_replies: string[] = [],
  extra: Partial<Omit<CoachReply, 'kind' | 'text' | 'quick_replies'>> = {},
): CoachReply => ({
  kind: 'reply',
  text,
  quick_replies,
  quiet_option: extra.quiet_option ?? null,
  foot: extra.foot ?? 'plan_unchanged',
  pending: extra.pending ?? null,
});

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function row(kind: ChangeRow['kind'], s: PlannedSession, diffs: ChangeDiff[] = [], extra: Partial<ChangeRow> = {}): ChangeRow {
  return {
    kind,
    session_id: s.id,
    date: sessionLocalDate(s),
    title: s.title,
    was_title: null,
    sport_id: s.sport_id,
    diffs,
    note: null,
    ...extra,
  };
}

/** The session at a new local day and wall-clock minute. */
function moveTo(s: PlannedSession, date: LocalDate, minute: number): PlannedSession {
  const start = atLocalTime(date, Math.floor(minute / 60), minute % 60);
  return { ...s, time_slot: { ...s.time_slot, start: toIsoWithOffset(start) } };
}

/** New length, with the template's parts and description sized to it. */
function resize(s: PlannedSession, minutes: number, prefs: Preferences): PlannedSession {
  const key = templateOf(s);
  const sized = { ...s, time_slot: { ...s.time_slot, duration: minutes * 60 } };
  if (!key) return sized;
  const workout = workoutFor(key, minutes, prefs);
  return withWorkout(sized, s.optional ? asNewIdea(workout) : workout);
}

function swapTo(s: PlannedSession, key: TemplateKey, prefs: Preferences): PlannedSession {
  const workout = workoutFor(key, sessionMinutes(s), prefs);
  return withWorkout(s, s.optional ? asNewIdea(workout) : workout);
}

/* ------------------------------------------------------------- Coach */

export function coach(input: CoachInput): CoachResult {
  const s = input.text.toLowerCase().trim();
  const has = (re: RegExp) => re.test(s);
  const { prefs, catalog, now } = input;
  const today = toLocalDate(now);
  const weekEnd = addDays(startOfWeek(today), 6);
  const plannedThrough = input.planned_through ?? weekEnd;
  const all = sortSessions(input.sessions);
  const live = all.filter((x) => x.status !== 'skipped');
  const upcoming = all.filter((x) => x.status === 'planned' && sessionLocalDate(x) >= today);
  const byId = (id: string) => all.find((x) => x.id === id) ?? null;
  const sportName = (id: string) => catalog.find((x) => x.id === id)?.name ?? capitalize(id.replace(/_/g, ' '));
  const dayName = (date: LocalDate) => relativeDayName(date, today);
  /** "today", "tomorrow" or "on Thursday" inside a sentence. */
  const dayPhrase = (date: LocalDate) => {
    const name = dayName(date);
    return name === 'Today' || name === 'Tomorrow' || name === 'Yesterday' ? name.toLowerCase() : `on ${name}`;
  };
  const sessionOn = (date: LocalDate, except?: string) =>
    live.find((x) => sessionLocalDate(x) === date && x.id !== except) ?? null;

  /** Free days from today up to the planned range, for "Which day works better?". */
  const freeDays = (minutes: number, except?: string, limit = 3) => {
    const out: string[] = [];
    for (let d = today; d <= plannedThrough && out.length < limit; d = addDays(d, 1)) {
      if (sessionOn(d, except)) continue;
      if (!slotFor(d, minutes, prefs, null, d === today ? now : undefined)) continue;
      out.push(dayName(d));
    }
    return out;
  };

  /** The lock line: which days stay as they were done. */
  const doneThisWeek = all.filter(
    (x) => x.status === 'completed' && sessionLocalDate(x) >= startOfWeek(today) && sessionLocalDate(x) <= today,
  );
  const doneDays = [...new Set(doneThisWeek.map((x) => formatDayLong(sessionLocalDate(x))))];
  const keptDone = () => {
    if (!doneDays.length) return 'Everything else stays the same.';
    if (doneDays.length === 1) return `${doneDays[0]} stays as you did it.`;
    return `${joinAnd(doneDays)} stay as you did them.`;
  };
  const keptHistory = () => {
    if (!doneDays.length) return "Everything you've done stays in your history.";
    if (doneDays.length === 1) return `${doneDays[0]}'s ${nounOf(doneThisWeek[0]).one.replace(/^an? /, '')} stays in your history.`;
    return `${joinAnd(doneDays)} stay in your history.`;
  };
  const change = (c: Omit<CoachChange, 'kind' | 'kept' | 'sport_switch' | 'not_changed' | 'added'> &
    Partial<Pick<CoachChange, 'kept' | 'sport_switch' | 'not_changed' | 'added'>>): CoachChange => ({
    kind: 'change',
    kept: keptDone(),
    sport_switch: null,
    not_changed: [],
    added: [],
    ...c,
  });

  /* 1. The demo failure: "fail" fails the first time (8.12). */
  if (has(/\bfail|\berror\b/) && !input.retry) return { kind: 'fail' };

  /* 2. Pain and health: no change, no advice beyond a doctor (8.11). */
  const part = s.match(/\b(knee|back|ankle|hip|shoulder|foot|leg|wrist|neck)s?\b/);
  if (has(/knee|hurt|pain|injur|sick|\bill\b|ache|sore|doctor|physio/)) {
    return reply(`${part ? `Sorry about your ${part[1]}.` : 'Sorry to hear that.'} ${HEALTH}`, ['Pause this week', 'Keep my plan']);
  }

  /* 3. Nothing to do. */
  if (has(/keep my plan|keep running|keep walking|never ?mind|no thanks|leave it/)) return reply('Okay. Nothing changes.');

  /* 4. A workout done outside the plan (8.16): only how long is ever asked. */
  const pendingWorkout = input.pending?.kind === 'workout' ? input.pending.draft : null;
  if ((pendingWorkout && (minutesIn(s) !== null || sportIn(s))) || has(DONE_WORDS)) {
    const draft = readWorkout(s, today, pendingWorkout);
    if (!draft.sport_id || !catalog.some((x) => x.id === draft.sport_id)) {
      return reply('Nice. Which sport was it?', ['Walk', 'Run', 'Bike ride', 'Gym'], {
        foot: 'nothing_saved',
        pending: { kind: 'workout', draft },
      });
    }
    if (!draft.minutes) {
      return reply('Nice. How long was it, roughly?', ['15 min', '30 min', '45 min', '1 hour'], {
        foot: 'nothing_saved',
        pending: { kind: 'workout', draft },
      });
    }
    return {
      kind: 'log',
      sport_id: draft.sport_id,
      title: draft.title ?? sportName(draft.sport_id),
      date: draft.date,
      minutes: draft.minutes,
      distance: draft.distance,
      evening: draft.evening,
    };
  }

  /* 5. A sport outside the catalog gets a plain no and a nearby option (8.10). */
  const other = s.match(OTHER_SPORTS);
  if (other) {
    return reply(`${capitalize(other[0])} isn't in our list of sports yet, so we can't plan it.`, [
      'Switch to gym',
      'Keep my plan',
    ]);
  }

  /* Which session the message is about, and which days it names as destinations. */
  const mentions = dayMentions(s, today);
  const weekStart = startOfWeek(today);
  const moveIntent = has(
    /\bmove\b|\binstead\b|\breschedul|\bdo it\b|\bpush\b|\bshift\b|\bput it\b|\bto (monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/,
  );
  const pendingId = input.pending && input.pending.kind !== 'workout' ? input.pending.session_id : null;
  const pendingMove = input.pending?.kind === 'move';
  const pinned = input.about ?? (pendingId ? byId(pendingId) : null);
  /** A day named as a session's day: this week's, or next week's when that is planned and this one has passed. */
  const namedDate = (m: Mention): LocalDate => {
    if (m.date) return m.date;
    const thisWeek = addDays(weekStart, m.weekday ?? 0);
    const nextWeek = addDays(thisWeek, 7);
    return thisWeek < today && nextWeek <= plannedThrough && sessionOn(nextWeek)?.status === 'planned'
      ? nextWeek
      : thisWeek;
  };
  const sessionNamed = (m: Mention) => {
    const d = namedDate(m);
    const onDay = all.filter((x) => sessionLocalDate(x) === d);
    // A session removed from an upcoming day leaves the day free.
    return onDay.find((x) => x.status !== 'skipped') ?? (d < today ? (onDay[0] ?? null) : null);
  };
  let source: PlannedSession | null = pinned;
  let targets = mentions;
  if (mentions.length && (!pinned || (!moveIntent && !pendingMove))) {
    const named = sessionNamed(mentions[0]);
    if (named) {
      source = named;
      targets = mentions.slice(1);
    }
  }
  const freeDayNamed = !source && !pinned && mentions.length > 0;
  const weekMain = live.filter(
    (x) => !x.optional && sessionLocalDate(x) >= weekStart && sessionLocalDate(x) <= weekEnd,
  );
  const room = weekMain.length < prefs.sessions_per_week;
  const switchTo = SWITCH_WORDS.find(([, re]) => re.test(s))?.[0] ?? null;

  /* 6. Add a session, or bring a removed one back (8.5). */
  const nextThisWeek = upcoming.find((x) => !x.optional && sessionLocalDate(x) <= weekEnd);
  const addOnFreeDay =
    freeDayNamed && room && has(/\b(do|have|fit|squeeze|go for)\b/) && (!moveIntent || !nextThisWeek);
  if ((has(/\badd\b|\bback\b/) && !has(/back (to|on)\b/)) || addOnFreeDay) {
    const skippedAfter = (from: LocalDate, to: LocalDate) =>
      [...all].reverse().find((x) => x.status === 'skipped' && sessionLocalDate(x) >= from && sessionLocalDate(x) <= to) ??
      null;
    const named = targets[0] ? (targets[0].date ?? nextWeekday(today, targets[0].weekday ?? 0)) : null;
    const removed = mentions.length
      ? named && named >= today
        ? skippedAfter(named, named)
        : null
      : skippedAfter(today, weekEnd);
    if (!room) {
      return reply(`Your week already has ${numberWord(weekMain.length)} sessions, as many as you asked for.`, ['Keep my plan']);
    }
    if (removed && !sessionOn(sessionLocalDate(removed))) {
      const back: PlannedSession = { ...removed, status: 'planned' };
      return change({
        summary: `${dayName(sessionLocalDate(back))} is back in your plan.`,
        rows: [
          row('added', back, [
            { field: 'time', from: null, to: formatTime(sessionStart(back)) },
            { field: 'duration', from: null, to: back.time_slot.duration },
          ]),
        ],
        updated: [back],
      });
    }
    if (source && source.status === 'planned') return reply(`${dayName(sessionLocalDate(source))} is in your plan already.`);
    const date = targets[0] ? (targets[0].date ?? nextWeekday(today, targets[0].weekday ?? 0)) : null;
    if (!date) {
      const days = freeDays(prefs.session_minutes);
      return reply(
        'Which day works?',
        days.map((d) => `Add one ${d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : `on ${d}`}`),
      );
    }
    if (date < today || date > plannedThrough || sessionOn(date)) {
      return reply(
        date > plannedThrough
          ? `${dayName(date)} isn't planned yet. Plans go one week ahead.`
          : `${dayName(date)} doesn't have room, and we plan one session a day. Which day works better?`,
        freeDays(prefs.session_minutes),
      );
    }
    const shorter = has(/\bshort|quick/);
    const minutes = shorter
      ? (LENGTHS.filter((l) => l < prefs.session_minutes).pop() ?? prefs.session_minutes)
      : prefs.session_minutes;
    const next = upcoming.find((x) => !x.optional);
    const sportId = switchTo && plannable(switchTo, prefs, catalog) ? switchTo : (next?.sport_id ?? 'walking');
    const key: TemplateKey = sportId === 'walking' && shorter ? 'short_walk' : templateForSport(sportId, prefs, 1);
    const start = slotFor(date, minutes, prefs, null, date === today ? now : undefined);
    if (!start) return reply(`There's no time left ${dayPhrase(date)}. Which day works better?`, freeDays(minutes));
    const workout = workoutFor(key, minutes, prefs);
    const added: PlannedSession = {
      id: input.newId(),
      sport_id: workout.sport_id,
      title: workout.title,
      time_slot: { start: toIsoWithOffset(start), duration: minutes * 60 },
      description: workout.description,
      status: 'planned',
      editable: true,
      plan_version: next?.plan_version ?? 1,
      optional: false,
      changed_in_version: null,
      log_id: null,
      ...workout.details,
    };
    const total = weekMain.length + 1;
    const still = total === prefs.sessions_per_week && weekMain.length < total ? 'still has' : 'has';
    return change({
      summary: `${dayName(date)} has ${nounOf(added).one} now, so the week ${still} ${numberWord(total)} sessions.`,
      rows: [
        row('added', added, [
          { field: 'time', from: null, to: formatTime(start) },
          { field: 'duration', from: null, to: minutes * 60 },
        ]),
      ],
      updated: [],
      added: [added],
    });
  }

  /* 7. Done days can't change (8.10). */
  if (source && source.status !== 'planned' && !input.about) {
    const ask = [...new Set(upcoming.slice(0, 2).map((x) => dayName(sessionLocalDate(x))))];
    const day = dayName(sessionLocalDate(source));
    const text =
      source.status === 'completed'
        ? `${day} is done, so it stays as you did it.`
        : `${day} was skipped, so it stays that way. There's nothing to make up.`;
    return reply(ask.length ? `${text} Want to change an upcoming day?` : text, ask);
  }
  if (source && source.status !== 'planned') source = null;

  /* A named day with nothing on it, and no move asked for. */
  if (freeDayNamed && !moveIntent) {
    const d = namedDate(mentions[0]);
    const ask = [...new Set(upcoming.slice(0, 3).map((x) => dayName(sessionLocalDate(x))))];
    return reply(`${dayName(d)} has no session. Which day did you mean?`, ask);
  }
  const n = source ?? upcoming.find((x) => !x.optional) ?? upcoming[0] ?? null;

  /* 8. A sport switch: upcoming sessions swap, history stays (8.6). */
  const gentle = has(/gentler activit|something gentler|walk instead|swap for a walk|\bswap\b/);
  const switching =
    switchTo &&
    !gentle &&
    !freeDayNamed &&
    (has(/\bgym\b/) || has(/\b(switch|change|go|back)\b.*\bto\b|\binstead\b|\btry\b|\brather\b/));
  if (switching && switchTo) {
    const name = sportName(switchTo);
    const sport = catalog.find((x) => x.id === switchTo);
    if (!sport || sport.availability !== 'working') {
      return reply(`${name} isn't something we can plan yet.`, ['Switch to gym', 'Keep my plan']);
    }
    if (!canDo(switchTo, prefs)) {
      return reply(`${name} doesn't fit the places and equipment in your answers. You can change them on the You tab.`, [
        'Keep my plan',
      ]);
    }
    const single = (mentions.length > 0 || input.about) && n ? n : null;
    const scope = single ? [single] : upcoming.filter((x) => !x.optional);
    const toSwap = scope.filter((x) => x.sport_id !== switchTo || (switchTo === 'walking' && has(/\bshort\b/)));
    if (!scope.length) return reply("There's no session left to change this week. Your next week starts on Monday.");
    if (!toSwap.length) return reply(`You're on ${name.toLowerCase()} already.`);
    const updated = toSwap.map((x, i) =>
      switchTo === 'walking' && has(/\bshort\b/)
        ? resize(swapTo(x, 'short_walk', prefs), Math.min(10, sessionMinutes(x)), prefs)
        : swapTo(x, templateForSport(switchTo, prefs, i), prefs),
    );
    const rows = updated.map((x, i) => {
      const diffs: ChangeDiff[] =
        sessionMinutes(x) !== sessionMinutes(toSwap[i])
          ? [{ field: 'duration', from: toSwap[i].time_slot.duration, to: x.time_slot.duration }]
          : [];
      return row('swapped', x, diffs, { was_title: toSwap[i].title });
    });
    if (single) {
      return change({
        summary: `${dayName(sessionLocalDate(updated[0]))} is ${nounOf(updated[0]).one} now, at the same time.`,
        rows,
        updated,
      });
    }
    const counts = new Map<string, number>();
    for (const x of scope) counts.set(x.sport_id, (counts.get(x.sport_id) ?? 0) + 1);
    const from = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const summary =
      switchTo === 'strength'
        ? `You're on ${updated[0].title === 'Strength at home' ? 'strength at home' : 'gym'} now. Same days and times, with short sessions we walk you through step by step.`
        : prefs.activity_interests.includes(switchTo)
          ? `You're back on ${name.toLowerCase()}. Same days and times.`
          : `You're on ${name.toLowerCase()} now. Same days and times.`;
    return change({ summary, rows, updated, sport_switch: { from, to: switchTo }, kept: keptHistory() });
  }


  /* Nothing left to change. */
  if (!n) {
    const removed = [...all].reverse().find((x) => x.status === 'skipped' && sessionLocalDate(x) >= today);
    return reply(
      "There's no session left to change this week. Your next week starts on Monday.",
      removed ? [`Add ${lowerFirstDay(dayName(sessionLocalDate(removed)))} back`] : [],
    );
  }
  const nDate = sessionLocalDate(n);
  const nDay = dayName(nDate);
  const nMin = sessionMinutes(n);
  const nTime = formatTime(sessionStart(n));
  const missed = nDate < today;
  const removeWords = has(/pause|drop|remove|skip|cancel|fewer days|day off|rest day/);

  /* 9. Move a missed session (8.15): free slots first, skipping last and quietly. */
  if (missed && !targets.length && !removeWords && !has(/short|morning|evening|\bat \d/)) {
    const slots: string[] = [];
    const [ws, we] = prefs.preferred_window ?? [7, 21];
    for (let d = today; d <= weekEnd && d <= plannedThrough && slots.length < 2; d = addDays(d, 1)) {
      if (sessionOn(d, n.id)) continue;
      const start = slotFor(d, nMin, prefs, null, d === today ? new Date(now.getTime() + 30 * 60_000) : undefined);
      if (!start) continue;
      const at = minutesOfDay(start);
      if (at < ws * 60 || at + nMin > we * 60) continue;
      slots.push(`${dayName(d)} at ${formatTime(start)}`);
    }
    const what = nounOf(n).one.replace(/^an? /, '');
    return reply(
      `${dayName(nDate)}'s ${what} didn't happen. Want to fit it in another time this week?`,
      [...slots, 'Another day'],
      { quiet_option: { label: 'Skip it this time', note: 'Nothing to make up.' }, pending: { kind: 'move', session_id: n.id } },
    );
  }

  /* 10. Remove, skip or pause: the session becomes a rest day (8.5). */
  if (removeWords) {
    const pause = has(/pause/) && !input.about;
    const scope = pause ? upcoming.filter((x) => sessionLocalDate(x) <= weekEnd) : [n];
    if (!scope.length) return reply("There's nothing left to pause this week.");
    const updated = scope.map((x) => ({ ...x, status: 'skipped' as const }));
    const what = nounOf(n).one.replace(/^an? /, '');
    const summary = pause
      ? 'This week is paused. Next week is planned as usual.'
      : missed
        ? `${dayName(nDate)}'s ${what} is skipped. Nothing to make up.`
        : `${nDay} is a rest day now.`;
    return change({ summary, rows: updated.map((x) => row('removed', x)), updated });
  }

  /* 11. Something gentler: an easy walk at the same time. */
  if (gentle) {
    const key: TemplateKey = canDo('walking', prefs) ? 'easy_walk' : 'stretching';
    const target = workoutFor(key, nMin, prefs);
    if (n.title === target.title) return reply(`${nDay} is already ${nounOf(n).one}.`);
    const updated = swapTo(n, key, prefs);
    return change({
      summary: `${nDay} is ${nounOf(updated).one} now, at the same time.`,
      rows: [row('swapped', updated, [], { was_title: n.title })],
      updated: [updated],
    });
  }

  /* 12. A vague "easier": one question with quick answers (8.9). */
  if (has(/easier|\beasy\b|lighter|simpler/)) {
    return reply('Sure. What would help most?', ['Shorter sessions', 'Fewer days', 'Gentler activities'], {
      pending: { kind: 'easier', session_id: source?.id ?? null },
    });
  }

  /* 13. Harder or longer stays out of a starting plan. */
  if (has(/harder|longer|more time|faster|marathon|\bmore\b.*\bminutes\b/)) {
    return reply("Plans stay gentle while you're starting out, so sessions keep the length you picked.", ['Keep my plan']);
  }

  const asked = timeIn(s);
  const morning = has(/morning|early|before work/) || (has(/\b7(:00)?\b/) && !asked);
  const evening = has(/evening|after work|tonight/);
  /** The wall-clock minute the request asks for, kept inside 7:00–21:00. */
  const wantedTime = (minutes: number): { minute: number; notChanged: { title: string; reason: string } | null } | null => {
    if (asked) {
      const latest = 21 * 60 - minutes;
      if (asked.minutes < 7 * 60) {
        return { minute: 7 * 60, notChanged: { title: `7:00, not ${asked.text}`, reason: WINDOW_REASON } };
      }
      if (asked.minutes > latest) {
        return { minute: latest, notChanged: { title: `${formatClock(latest)}, not ${asked.text}`, reason: WINDOW_REASON } };
      }
      return { minute: asked.minutes, notChanged: null };
    }
    if (morning) {
      const w = prefs.preferred_window;
      return { minute: (w && w[0] < 12 ? w[0] : 7) * 60, notChanged: null };
    }
    if (evening) return { minute: 18 * 60, notChanged: null };
    return null;
  };

  /* 14. Move to another day (8.7): the valid part applies, the rest says why. */
  const bareDay = /^(on )?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)( at [\d:.]+\s*(am|pm)?)?[.!]?$/.test(s);
  const destination = targets.find((m) => (m.date ?? nextWeekday(today, m.weekday ?? 0)) !== nDate) ?? targets[0];
  if (destination && (moveIntent || pinned || bareDay)) {
    const date = destination.date ?? nextWeekday(today, destination.weekday ?? 0);
    if (date === nDate && !asked) return reply(`It's ${dayPhrase(date)} already.`);
    if (date < today) return reply('That day has passed. Which day works better?', freeDays(nMin, n.id), { pending: { kind: 'move', session_id: n.id } });
    if (date > plannedThrough) {
      return reply(`${dayName(date)} isn't planned yet. Plans go one week ahead.`, freeDays(nMin, n.id), {
        pending: { kind: 'move', session_id: n.id },
      });
    }
    if (sessionOn(date, n.id)) {
      return reply(
        `${dayName(date)} already has a session, and we plan one a day. Which day works better?`,
        freeDays(nMin, n.id),
        { pending: { kind: 'move', session_id: n.id } },
      );
    }
    const wanted = wantedTime(nMin);
    let minute = wanted?.minute ?? minutesOfDay(sessionStart(n));
    if (date === today && atLocalTime(date, Math.floor(minute / 60), minute % 60) < now) {
      const later = slotFor(date, nMin, prefs, null, now);
      if (!later) return reply(`There's no time left today. Which day works better?`, freeDays(nMin, n.id));
      minute = minutesOfDay(later);
    }
    const moved = moveTo(n, date, minute);
    const newTime = formatTime(sessionStart(moved));
    const diffs: ChangeDiff[] = [{ field: 'date', from: nDate, to: date }];
    if (newTime !== nTime) diffs.push({ field: 'time', from: nTime, to: newTime });
    const early = wanted?.notChanged && asked?.early;
    const tail = early
      ? `, starting at ${newTime}, the earliest time we plan.`
      : newTime !== nTime
        ? `, at ${newTime}.`
        : ', same time.';
    return change({
      summary: `${missed ? `${nDay}'s ${nounOf(n).one.replace(/^an? /, '')}` : `${nDay}'s session`} is ${dayPhrase(date)} now${tail}`,
      rows: [row('moved', moved, diffs)],
      not_changed: wanted?.notChanged ? [wanted.notChanged] : [],
      updated: [moved],
    });
  }

  /* 15. Mornings, evenings, a time or a shorter length (8.3). */
  const shorter = has(/short|less time|quick|\bmin/);
  const wanted = wantedTime(nMin);
  if (wanted || shorter) {
    const everything = has(/\b(everything|all|every|only)\b|\bsessions\b/);
    const timeScope = everything ? upcoming.filter((x) => sessionLocalDate(x) <= weekEnd) : [n];
    const askedMin = s.match(/(\d+)\s*min/);
    const askedLength = askedMin ? Number(askedMin[1]) : null;
    const durationScope = everything && !mentions.length ? timeScope : [n];
    const notChanged: { title: string; reason: string }[] = [];
    if (wanted?.notChanged) notChanged.push(wanted.notChanged);
    const lengthFor = (cur: number) => {
      if (!shorter) return cur;
      if (askedLength) return LENGTHS.filter((l) => l <= Math.max(askedLength, 5)).pop() ?? 5;
      return LENGTHS.filter((l) => l < cur).pop() ?? cur;
    };
    if (askedLength && shorter) {
      const snapped = lengthFor(nMin);
      if (snapped !== askedLength) notChanged.push({ title: `${snapped} min, not ${askedLength}`, reason: LENGTH_REASON });
    }
    const rows: ChangeRow[] = [];
    const updated: PlannedSession[] = [];
    for (const x of timeScope.includes(n) ? timeScope : [...timeScope, n]) {
      const curMin = sessionMinutes(x);
      const curTime = formatTime(sessionStart(x));
      const min = durationScope.includes(x) ? lengthFor(curMin) : curMin;
      let next = x;
      if (wanted && timeScope.includes(x)) next = moveTo(next, sessionLocalDate(x), Math.min(wanted.minute, 21 * 60 - min));
      if (min !== curMin) next = resize(next, min, prefs);
      const diffs: ChangeDiff[] = [];
      const newTime = formatTime(sessionStart(next));
      if (newTime !== curTime) diffs.push({ field: 'time', from: curTime, to: newTime });
      if (min !== curMin) diffs.push({ field: 'duration', from: curMin * 60, to: min * 60 });
      if (!diffs.length) continue;
      let note: string | null = null;
      if (min !== curMin && templateOf(x) === 'walk_run') {
        const runs = walkRunCount(min, prefs);
        const before = walkRunCount(curMin, prefs);
        note = runs === 1 ? 'One run, with walks either side.' : `${capitalize(numberWord(runs))} runs instead of ${numberWord(before)}.`;
      }
      rows.push(row('changed', next, diffs, { note }));
      updated.push(next);
    }
    if (!rows.length) {
      return reply(
        everything && wanted
          ? `Your sessions are already at ${formatClock(wanted.minute)}, so there's nothing to update.`
          : `${nDay} is already at ${nTime} for ${nMin} minutes, so there's nothing to update.`,
      );
    }
    const nNext = updated.find((x) => x.id === n.id);
    const nMinNext = nNext ? sessionMinutes(nNext) : nMin;
    const nTimeNext = nNext ? formatTime(sessionStart(nNext)) : nTime;
    let summary: string;
    if (everything && wanted) {
      summary = `All your sessions are at ${formatClock(wanted.minute)} now`;
      summary += nMinNext !== nMin ? `, and ${nDay} is ${nMinNext} minutes.` : '.';
    } else if (rows.length > 1) {
      summary = `${joinAnd(rows.map((r, i) => (i ? lowerFirstDay(dayName(r.date)) : dayName(r.date))))} are shorter now.`;
    } else {
      const what = [nTimeNext !== nTime && `at ${nTimeNext}`, nMinNext !== nMin && `${nMinNext} minutes`].filter(Boolean);
      summary = `${nDay} is ${what.join(' and ')} now.`;
    }
    return change({ summary, rows, not_changed: notChanged, updated });
  }

  /* 16. A vague move: one question with the free days (8.9). */
  if (has(/\bmove\b|another day|other day|later|reschedul|different day/)) {
    const days = freeDays(nMin, n.id);
    return reply(days.length ? 'Which day works better?' : "There's no free day left this week.", days, {
      pending: { kind: 'move', session_id: n.id },
    });
  }

  /* 17. Ask for the missing detail. */
  return reply('Tell us a little more: which day, and what should change?', [
    `Make ${lowerFirstDay(nDay)} shorter`,
    `Move ${lowerFirstDay(nDay)} to the morning`,
  ]);
}

/** "today" stays lowercase mid-sentence; weekday names keep their capital. */
function lowerFirstDay(day: string): string {
  return day === 'Today' || day === 'Tomorrow' ? lowerFirst(day) : day;
}

/** The first date from today on (today included) that falls on this weekday. */
function nextWeekday(today: LocalDate, weekday: number): LocalDate {
  return addDays(today, (weekday - weekdayIndex(today) + 7) % 7);
}
