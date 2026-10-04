import { useLog } from '@/api/hooks';
import type { ActivityLog, Felt, PlannedSession } from '@/api/types';
import { formatMinutes, formatTime } from '@/lib/dates';
import { sessionMinutes, sessionStart } from '@/lib/sessions';

import { feltLabel, type MarkState } from './day-items';

export type SessionFacts = {
  /** '7:00': when it was done, else when it is planned. */
  time: string;
  /** The logged length once done, else the planned one. */
  minutes: number;
  felt: Felt | null;
};

/** What a session line says about a session; a done one reads its log. */
export function useSessionFacts(session: PlannedSession, state: MarkState): SessionFacts {
  const log = useLog(state === 'done' ? session.log_id : null).data;
  return {
    time: formatTime(log ? log.started_at : sessionStart(session)),
    minutes: log ? log.duration_seconds / 60 : sessionMinutes(session),
    felt: log?.feedback?.felt ?? null,
  };
}

/** A logged extra's facts. */
export function extraFacts(log: ActivityLog): SessionFacts {
  return { time: formatTime(log.started_at), minutes: log.duration_seconds / 60, felt: log.feedback?.felt ?? null };
}

/** '20 min · felt easy' */
export function lengthAndFelt({ minutes, felt }: SessionFacts): string {
  return formatMinutes(minutes) + (felt ? ` · felt ${feltLabel(felt)}` : '');
}

/** '7:00 · 20 min · felt easy' */
export function factsLine(facts: SessionFacts): string {
  return `${facts.time} · ${lengthAndFelt(facts)}`;
}
