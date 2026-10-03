import { useLocalSearchParams } from 'expo-router';

import { ActivityScreen } from '@/features/workout/activity/activity-screen';

/** Activity (6): the session's plan, with Log it, or Start for a gym session. */
export default function SessionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ActivityScreen key={id} id={id} />;
}
