/**
 * Our assistant's description of the person (Profile 9–9.3), built from the
 * answers and the feedback only. Every statement cites at least one stored
 * fact; second person, no scores, streaks, percentages or praise. With fewer
 * than three completed sessions it says what it doesn't know yet.
 */
import { formatDateShort, formatDayLong, joinAnd } from '../../lib/dates';
import { optionLabel, sectionLine } from '../../lib/preference-options';
import type {
  ActivityLog,
  ActivityOpinion,
  AssistantSummary,
  IsoDateTime,
  Preferences,
  SportDefinition,
  SummaryEvidence,
  SummaryStatement,
} from '../types';

export interface SummaryInput {
  prefs: Preferences;
  logs: ActivityLog[];
  opinions: ActivityOpinion[];
  catalog: SportDefinition[];
  generated_at: IsoDateTime | null;
}

const HELPS: Record<string, string> = {
  time: 'Short sessions with nothing to set up, since finding time is the hard part.',
  low_energy: 'Gentle sessions that still count on a tired day, since energy can run low.',
  boredom: 'Some variety from week to week, so the same thing doesn’t get old.',
  uncertainty: 'Clear steps for every session, so you always know what to do.',
  discomfort: 'Quiet places and an easy pace, so moving feels comfortable.',
};

function answer(id: string, section: SummaryEvidence['section'], title: string, detail: string): SummaryEvidence {
  return { id, kind: 'answer', title, detail, section, session_id: null };
}

/** "in the morning" from the preferred window. */
function timeOfDay(window: [number, number] | null): string | null {
  if (!window) return null;
  if (window[1] <= 12) return 'in the morning';
  if (window[0] >= 17) return 'in the evening';
  if (window[0] >= 11 && window[1] <= 15) return 'around midday';
  return null;
}

/** "Monday 19 Oct" */
const dayDate = (value: string) => `${formatDayLong(value)} ${formatDateShort(value)}`;

const PLACE_WORDS: Record<string, string> = { outdoors: 'outdoors', home: 'at home', gym: 'at the gym', pool: 'in the pool' };

export function buildSummary({ prefs, logs, opinions, catalog, generated_at }: SummaryInput): AssistantSummary {
  const completed = logs.filter((l) => !l.extra);
  const littleData = completed.length < 3;
  const statements: SummaryStatement[] = [];
  const answers = { ...prefs };

  /* What you enjoy: from the answers. */
  const when = timeOfDay(prefs.preferred_window);
  const where = prefs.available_locations[0] ? PLACE_WORDS[prefs.available_locations[0]] : null;
  const context = [when, where].filter((x): x is string => !!x);
  statements.push({
    id: 'enjoy-answers',
    group: 'enjoy',
    text: `Moving ${context.map((c) => `${c}, `).join('')}for about ${prefs.session_minutes} minutes.`,
    source_kind: 'answers',
    source_label: 'Your answers',
    evidence: [
      answer('answer-time', 'time', 'Time', sectionLine('time', answers, catalog)),
      answer('answer-places', 'places', 'Places', sectionLine('places', answers, catalog)),
    ],
  });

  /* What you enjoy: the activities you'd choose again. */
  const recent = [...opinions].sort((a, b) => b.last_date.localeCompare(a.last_date));
  const yes = recent.filter((o) => o.opinion === 'yes');
  if (!littleData && yes.length) {
    const evidence: SummaryEvidence[] = [];
    const newestFirst = [...completed].sort((a, b) => b.started_at.localeCompare(a.started_at));
    for (const l of newestFirst) {
      if (l.feedback?.choose_again === 'yes' && yes.some((o) => o.title === l.title)) {
        evidence.push({
          id: `session-${l.id}`,
          kind: 'feedback',
          title: l.title,
          detail: `${dayDate(l.started_at)} · you said yes`,
          section: null,
          session_id: l.session_id,
        });
      }
    }
    if (!evidence.length) {
      evidence.push(
        ...yes.map((o) => ({
          id: `opinion-${o.activity_key}`,
          kind: 'feedback' as const,
          title: o.title,
          detail: `${formatDateShort(o.last_date)} · you said yes`,
          section: null,
          session_id: null,
        })),
      );
    }
    const titles = yes.map((o) => o.title.toLowerCase());
    const named = joinAnd([titles[0].charAt(0).toUpperCase() + titles[0].slice(1), ...titles.slice(1)]);
    statements.push({
      id: 'enjoy-feedback',
      group: 'enjoy',
      text: `${named}. You'd choose ${yes.length === 1 ? 'it' : yes.length === 2 ? 'both' : 'them'} again.`,
      source_kind: 'feedback',
      source_label: `Your feedback on ${evidence.length} session${evidence.length === 1 ? '' : 's'}`,
      evidence,
    });
  }

  /* What helps: the hardest part, else the starting point. */
  const obstacle = prefs.starting_obstacles[0];
  statements.push({
    id: 'helps-answers',
    group: 'helps',
    text: obstacle ? HELPS[obstacle] : 'A gentle start, with rest days between sessions.',
    source_kind: 'answers',
    source_label: 'Your answers',
    evidence: [
      obstacle
        ? answer('answer-extras', 'extras', 'Good to know', sectionLine('extras', answers, catalog))
        : answer(
            'answer-starting',
            'starting',
            'Starting point',
            optionLabel('starting_comfort', prefs.starting_comfort),
          ),
    ],
  });

  /* What we leave out: avoidances, "not for now" and switched-off activities. */
  const no = recent.filter((o) => o.opinion === 'no');
  const excluded = prefs.excluded_activity_types;
  const leaveOut: string[] = [
    ...prefs.avoidances.map((a) => optionLabel('avoidances', a).toLowerCase()),
    ...no.map((o) => `the ${o.title.toLowerCase()} for now`),
    ...excluded.map((id) => (catalog.find((s) => s.id === id)?.name ?? id).toLowerCase()),
  ];
  if (leaveOut.length) {
    const evidence: SummaryEvidence[] = [];
    if (prefs.avoidances.length) evidence.push(answer('answer-avoid', 'extras', 'Good to know', sectionLine('extras', answers, catalog)));
    for (const o of no) {
      evidence.push({
        id: `opinion-${o.activity_key}`,
        kind: 'feedback',
        title: o.title,
        detail: `${dayDate(o.last_date)} · you said not for now`,
        section: null,
        session_id: completed.find((l) => l.title === o.title)?.session_id ?? null,
      });
    }
    for (const id of excluded) {
      evidence.push({
        id: `excluded-${id}`,
        kind: 'feedback',
        title: catalog.find((s) => s.id === id)?.name ?? id,
        detail: 'Switched off',
        section: null,
        session_id: null,
      });
    }
    const labels = [
      prefs.avoidances.length ? 'Your answers' : null,
      no.length ? `your feedback on ${joinAnd(no.map((o) => formatDateShort(o.last_date)))}` : null,
      excluded.length ? 'what you switched off' : null,
    ].filter((x): x is string => !!x);
    const text = joinAnd(leaveOut);
    statements.push({
      id: 'leave-out',
      group: 'leave_out',
      text: `${text.charAt(0).toUpperCase()}${text.slice(1)}.`,
      source_kind: no.length || excluded.length ? 'feedback' : 'answers',
      source_label: labels.map((l, i) => (i ? l : l.charAt(0).toUpperCase() + l.slice(1))).join(' · '),
      evidence,
    });
  }

  const yesTitles = yes.map((o) => o.title.toLowerCase());
  return {
    status: 'ready',
    generated_at,
    little_data: littleData,
    title: titleFor(prefs),
    headline: littleData
      ? "More once you've tried a few sessions."
      : yesTitles.length
        ? `You'd choose ${joinAnd(yesTitles.slice(0, 2))} again.`
        : 'You keep to the times you picked.',
    statements: statements.filter((st) => st.evidence.length > 0),
  };
}

/** The card's title on the You tab: "Mornings, on foot." */
function titleFor(prefs: Preferences): string {
  const window = prefs.preferred_window;
  const when = !window ? 'Any time' : window[1] <= 12 ? 'Mornings' : window[0] >= 17 ? 'Evenings' : 'Daytime';
  const interests = prefs.activity_interests;
  const how = interests.length && interests.every((id) => id === 'walking' || id === 'running' || id === 'hiking')
    ? 'on foot'
    : interests.includes('strength')
      ? 'getting stronger'
      : interests.includes('swimming')
        ? 'in the water'
        : interests.length
          ? 'your way'
          : 'trying things out';
  return `${when}, ${how}.`;
}
