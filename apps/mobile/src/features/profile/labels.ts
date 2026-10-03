/**
 * Copy for the profile screens (design/prototype/profile.jsx): kickers, the
 * feedback counts on You and the meta line of each feedback card.
 */
import type {
  ActivityOpinion,
  AssistantSummary,
  ChooseAgain,
  FeedbackOverview,
  LocalDate,
  SportDefinition,
  SummaryGroup,
  SummarySourceKind,
  SummaryStatement,
} from '@/api/types';
import type { IconName } from '@/components/ui';
import { diffDays, formatDateShort, formatDayLong, startOfWeek, toLocalDate } from '@/lib/dates';
import { activityLabel } from '@/lib/preference-options';

export const GROUP_TITLES: Record<SummaryGroup, string> = {
  enjoy: 'What you enjoy',
  helps: 'What helps',
  leave_out: 'What we leave out',
};

export const GROUP_ORDER: SummaryGroup[] = ['enjoy', 'helps', 'leave_out'];

/** The small icon before a statement's source. */
export function statementIcon(statement: SummaryStatement): IconName {
  if (statement.group === 'leave_out') return 'ban';
  const icons: Record<SummarySourceKind, IconName> = { answers: 'list-checks', feedback: 'heart', sessions: 'heart' };
  return icons[statement.source_kind];
}

/** 'today', 'yesterday', 'Monday' within the week, else '19 Oct'. */
function whenText(value: string, today: Date): string {
  const days = diffDays(toLocalDate(value), toLocalDate(today));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return formatDayLong(value);
  return formatDateShort(value);
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Ana · week 3"; either part may be missing. */
export function youKicker(name: string | null | undefined, firstWeekStart: LocalDate | null | undefined, today: Date) {
  const first = name?.trim().split(/\s+/)[0] || null;
  const week = firstWeekStart ? Math.max(1, Math.floor(diffDays(firstWeekStart, startOfWeek(today)) / 7) + 1) : null;
  if (first && week) return `${first} · week ${week}`;
  if (week) return `Week ${week}`;
  return first;
}

/** The You card's kicker: who wrote it and when (9), or what it is based on in week one (9.1). */
export function cardKicker(summary: AssistantSummary, today: Date): string {
  if (summary.status === 'updating') return 'By our assistant · updating';
  if (summary.little_data || !summary.generated_at) return 'By our assistant · from your answers';
  return `By our assistant · updated ${whenText(summary.generated_at, today)}`;
}

/** 9.2's kicker: "Updated today · from your answers and feedback". */
export function summaryKicker(summary: AssistantSummary, today: Date): string {
  const sources = summary.statements.some((s) => s.source_kind !== 'answers')
    ? 'from your answers and feedback'
    : 'from your answers';
  if (summary.status === 'updating') return `Updating · ${sources}`;
  if (!summary.generated_at) return sentence(sources);
  return `Updated ${whenText(summary.generated_at, today)} · ${sources}`;
}

/** The Your feedback row on You: "2 you'd choose again · 1 not for now". */
export function feedbackCounts(overview: FeedbackOverview): string {
  const count = (opinion: ChooseAgain) => overview.opinions.filter((o) => o.opinion === opinion).length;
  const yes = count('yes');
  const no = count('no');
  const maybe = count('maybe');
  const off = overview.excluded_sport_ids.length;
  const parts = [
    yes ? `${yes} you'd choose again` : null,
    no ? `${no} not for now` : null,
    !yes && !no && maybe ? `${maybe} maybe` : null,
    off ? `${off} switched off` : null,
  ].filter((p): p is string => !!p);
  return parts.length ? parts.join(' · ') : 'We ask after each session';
}

/** Short sport name for a meta line: "Run", "Strength". */
export function shortSportName(sportId: string, sports: SportDefinition[] | undefined): string {
  return activityLabel(sportId, sports).split(/ \(| \//)[0];
}

/** "Run · last done Monday", "Mobility · a new idea on 15 Oct", "Walk · tried 20 Oct". */
export function opinionMeta(opinion: ActivityOpinion, sports: SportDefinition[] | undefined, today: Date): string {
  const sport = shortSportName(opinion.sport_id, sports);
  const when = whenText(opinion.last_date, today);
  const on = when === 'today' || when === 'yesterday' ? when : `on ${when}`;
  if (opinion.opinion === 'no') return `${sport} · tried ${when}`;
  if (opinion.new_idea) return `${sport} · a new idea ${on}`;
  return `${sport} · last done ${when}`;
}
