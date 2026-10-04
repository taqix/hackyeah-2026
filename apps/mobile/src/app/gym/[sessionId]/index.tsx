import { useLocalSearchParams } from 'expo-router';

import { GymSessionScreen } from '@/features/gym';

/** Guided gym 6.3–6.7. */
export default function GymRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <GymSessionScreen key={sessionId} sessionId={sessionId} />;
}
