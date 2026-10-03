import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function GymRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return (
    <PlaceholderScreen
      title="Guided gym"
      screenId="6.3–6.7"
      links={[{ label: 'Finish', href: routes.gymReview(sessionId, 'demo-log'), replace: true }]}
    />
  );
}
