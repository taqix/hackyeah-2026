/**
 * Plan history (Calendar 10.1) and Home's Plan updated note from the version
 * history, completions and chat, pure.
 */
import { formatDayLong, joinAnd, numberWord } from '../../../lib/dates';
import type { PlanState, PlanVersion, PlanVersionSource } from '../../types';
import type { ActivityCompletionEntity, ChatMessageEntity, PlanVersionEntity } from '../wire';

/**
 * Where a version came from: the first one is the first plan; a later
 * generate for a new week is the weekly plan, and one for a week that was
 * already planned re-planned it from saved answers.
 */
export function versionSource(version: PlanVersionEntity, versions: PlanVersionEntity[]): PlanVersionSource {
  if (version.origin === 'revise') return 'chat';
  if (version.origin === 'undo') return 'undo';
  const earlier = versions.filter((v) => v.version < version.version);
  if (!earlier.length) return 'first_plan';
  return earlier.some((v) => v.plan.week_start === version.plan.week_start) ? 'answers' : 'weekly_plan';
}

/** "Monday and Wednesday were done in this version.", from the completions saved against it. */
export function keptNote(version: PlanVersionEntity, completions: ActivityCompletionEntity[]): string | null {
  const doneIds = new Set(completions.filter((c) => c.plan_version_id === version.id).map((c) => c.activity_id));
  const done = version.plan.activities
    .filter((activity) => doneIds.has(activity.id))
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  if (!done.length) return null;
  if (done.length === version.plan.activities.length && done.length > 2) {
    return `All ${numberWord(done.length)} were done in this version.`;
  }
  const days = [...new Set(done.map((activity) => formatDayLong(activity.start_at)))];
  return `${joinAnd(days)} ${days.length === 1 ? 'was' : 'were'} done in this version.`;
}

export interface VersionsInput {
  versions: PlanVersionEntity[];
  activeVersionId: string | null;
  completions: ActivityCompletionEntity[];
  /** The plan's chat; [] when it could not be read. */
  messages: ChatMessageEntity[];
}

/** Newest first. */
export function versionsFromWire(input: VersionsInput): PlanVersion[] {
  return [...input.versions]
    .sort((a, b) => b.version - a.version)
    .map((version) => ({
      version: version.version,
      created_at: version.created_at,
      source: versionSource(version, input.versions),
      summary: version.summary,
      kept_note: keptNote(version, input.completions),
      chat_message_id:
        input.messages.find((m) => m.role === 'assistant' && m.plan_version_id === version.id)?.id ?? null,
      active: version.id === input.activeVersionId,
    }));
}

/** The newest chat change, as Home's Plan updated note. */
export function latestPlanChange(messages: ChatMessageEntity[]): ChatMessageEntity | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === 'assistant' && message.outcome === 'plan_updated') return message;
  }
  return null;
}

/**
 * Home's Plan updated note: the newest chat change newer than the moment the
 * person last dismissed it. Without a dismissal on this device, only a change
 * that made the plan in use counts, so an old change does not come back.
 */
export function recentChange(
  messages: ChatMessageEntity[],
  seenAt: string | null,
  activeVersionId: string | null,
): PlanState['recent_change'] {
  const latest = latestPlanChange(messages);
  if (!latest) return null;
  const unseen = seenAt
    ? Date.parse(latest.created_at) > Date.parse(seenAt)
    : latest.plan_version_id !== null && latest.plan_version_id === activeVersionId;
  if (!unseen) return null;
  return { summary: latest.content, chat_message_id: latest.id, created_at: latest.created_at };
}
