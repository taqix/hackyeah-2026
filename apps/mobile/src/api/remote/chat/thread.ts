/**
 * Stored chat messages as the app's thread. The API keeps plain text with an
 * outcome; the app's cards come from here: user bubbles (with the session they
 * were about, remembered locally), replies, and change cards diffed from the
 * plan versions. Pure.
 */
import type { ChatMessage, PlanChange, SessionRef } from '../../types';
import type { ToAppSportId } from '../mappers';
import { previousOfWeek } from '../plan/weeks';
import type { ChatMessageEntity, PlanVersionEntity } from '../wire';
import { diffVersions, KEPT_LINE } from './diff';

export interface ThreadContext {
  /** Every version of the plan, any order (history plus the active one). */
  versions: PlanVersionEntity[];
  activeVersionId: string | null;
  /**
   * Done sessions, saved or still a local draft: activity ID → the version
   * number it was logged against (null when that version is unknown).
   */
  done: ReadonlyMap<string, number | null>;
  /** request_id → the session a sent message was about. */
  about: Readonly<Record<string, SessionRef>>;
  toAppSportId: ToAppSportId;
}

/** For a thread without change cards: nothing else is needed. */
export const EMPTY_THREAD_CONTEXT: ThreadContext = {
  versions: [],
  activeVersionId: null,
  done: new Map(),
  about: {},
  toAppSportId: (id) => `sport-${id}`,
};

export const isChangeMessage = (message: ChatMessageEntity) =>
  message.role === 'assistant' && message.outcome === 'plan_updated';

/** The version a change replaced: the newest older version of the same week. */
export function previousVersion(versions: PlanVersionEntity[], to: PlanVersionEntity): PlanVersionEntity | null {
  return previousOfWeek(to, versions);
}

/**
 * The change card for a plan_updated message.
 * - Rows: the message's version against the previous one of that week; sessions
 *   done before the change are never rows.
 * - undone: the version right after it is an undo (Undo restores the version
 *   before the active change as the next version).
 * - can_undo: only the newest change, while its version is active and none of
 *   the sessions it changed is done (the server answers UNDO_LOCKED then).
 */
export function changeFromWire(
  message: ChatMessageEntity,
  context: ThreadContext,
  newest: boolean,
): PlanChange {
  const to = context.versions.find((version) => version.id === message.plan_version_id);
  if (!to) {
    // The version is not loaded (should not happen): show the summary only.
    return {
      from_version: 0,
      to_version: 0,
      summary: message.content,
      sport_switch: null,
      rows: [],
      not_changed: [],
      kept: '',
      can_undo: false,
      undone: false,
    };
  }
  const before = previousVersion(context.versions, to);
  const doneBefore = new Set(
    [...context.done].filter(([, version]) => version !== null && version < to.version).map(([id]) => id),
  );
  const diff = diffVersions(before, to, { toAppSportId: context.toAppSportId, skip: doneBefore });
  const weekActivities = [...to.plan.activities, ...(before?.plan.activities ?? [])];
  const undone = context.versions.some((version) => version.version === to.version + 1 && version.origin === 'undo');
  return {
    from_version: before?.version ?? to.version - 1,
    to_version: to.version,
    summary: message.content,
    sport_switch: diff.sport_switch,
    rows: diff.rows,
    not_changed: [],
    kept: weekActivities.some((activity) => context.done.has(activity.id)) ? KEPT_LINE : '',
    can_undo:
      newest &&
      !undone &&
      to.id === context.activeVersionId &&
      !diff.changedIds.some((id) => context.done.has(id)),
    undone,
  };
}

/** Stored messages, oldest first, as the app's thread. */
export function threadFromWire(messages: ChatMessageEntity[], context: ThreadContext): ChatMessage[] {
  const newestChangeId = [...messages].reverse().find(isChangeMessage)?.id ?? null;
  return messages.map((message): ChatMessage => {
    const base = { id: message.id, created_at: message.created_at };
    if (message.role === 'user') {
      const about = context.about[message.request_id] ?? null;
      return { ...base, role: 'user', kind: 'text', text: message.content, about };
    }
    if (isChangeMessage(message)) {
      const change = changeFromWire(message, context, message.id === newestChangeId);
      return { ...base, role: 'coach', kind: 'change', change };
    }
    // A reply or a clarifying question: the plan stayed as it was. The API has no quick replies.
    return {
      ...base,
      role: 'coach',
      kind: 'reply',
      text: message.content,
      quick_replies: [],
      quiet_option: null,
      foot: 'plan_unchanged',
    };
  });
}
