import { useLocalSearchParams } from 'expo-router';

import { LogScreen } from '@/features/workout/log/log-screen';

/** Log it (6.1, 6.2, 6.9, 6.10): `sessionId` is a planned session or `new`; `logId` edits a saved log. */
export default function LogRoute() {
  const { sessionId, logId } = useLocalSearchParams<{ sessionId: string; logId?: string }>();
  return <LogScreen key={`${sessionId}:${logId ?? ''}`} sessionId={sessionId} logId={logId} />;
}
