import { useLocalSearchParams } from 'expo-router';

import { FeedbackScreen } from '@/features/feedback';

export default function FeedbackRoute() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  return <FeedbackScreen logId={logId} />;
}
