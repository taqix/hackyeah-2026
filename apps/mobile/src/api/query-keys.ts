import type { LocalDate } from './types';

/** Every query key in one place, so mutations can invalidate precisely. */
export const queryKeys = {
  session: ['auth', 'session'] as const,
  sports: ['catalog', 'sports'] as const,
  preferences: ['preferences'] as const,
  planState: ['plan', 'state'] as const,
  planAll: ['plan'] as const,
  week: (weekStart: LocalDate) => ['plan', 'week', weekStart] as const,
  sessions: (from: LocalDate, to: LocalDate) => ['plan', 'sessions', from, to] as const,
  plannedSession: (id: string) => ['plan', 'session', id] as const,
  versions: ['plan', 'versions'] as const,
  log: (id: string) => ['logs', id] as const,
  logsAll: ['logs'] as const,
  lastExercise: (key: string) => ['logs', 'last-exercise', key] as const,
  lastExerciseAll: ['logs', 'last-exercise'] as const,
  chat: ['chat', 'messages'] as const,
  summary: ['profile', 'summary'] as const,
  feedback: ['profile', 'feedback'] as const,
  account: ['account'] as const,
};
