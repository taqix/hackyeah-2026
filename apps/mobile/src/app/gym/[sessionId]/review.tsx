import { useLocalSearchParams } from 'expo-router';

import { GymReviewScreen } from '@/features/gym';

/** What you did 6.8. */
export default function GymReviewRoute() {
  const { sessionId, logId } = useLocalSearchParams<{ sessionId: string; logId: string }>();
  return <GymReviewScreen key={logId} sessionId={sessionId} logId={logId} />;
}
