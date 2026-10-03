import type { Href } from 'expo-router';

import type { PreferenceSection } from '@/api/types';

/** Search params of the chat routes, `(tabs)/chat` and `coach`. */
export type ChatRouteParams = {
  /** Text placed in the message box, not sent. */
  prefill?: string;
  /** Session id the conversation is about. */
  about?: string;
  intent?: 'move';
};

/** Typed hrefs for every parameterised route. Static routes are plain strings. */
export const routes = {
  /** Today tab; `week` is a Monday (YYYY-MM-DD), `day` a date in that week. */
  today: ({ week, day }: { week?: string; day?: string } = {}): Href => ({
    pathname: '/(tabs)',
    params: {
      ...(week ? { week } : null),
      ...(day ? { day } : null),
    },
  }),
  session: (id: string): Href => ({ pathname: '/session/[id]', params: { id } }),
  /** Log it. `sessionId` is a planned session id or `new`; `logId` edits a logged extra. */
  log: (sessionId: string | 'new', logId?: string): Href => ({
    pathname: '/log/[sessionId]',
    params: logId ? { sessionId, logId } : { sessionId },
  }),
  gym: (sessionId: string): Href => ({ pathname: '/gym/[sessionId]', params: { sessionId } }),
  gymReview: (sessionId: string, logId: string): Href => ({
    pathname: '/gym/[sessionId]/review',
    params: { sessionId, logId },
  }),
  feedback: (logId: string): Href => ({ pathname: '/feedback/[logId]', params: { logId } }),
  profileEdit: (section: PreferenceSection): Href => ({
    pathname: '/profile/edit/[section]',
    params: { section },
  }),
  why: (statementId: string): Href => ({
    pathname: '/profile/why/[statementId]',
    params: { statementId },
  }),
};
