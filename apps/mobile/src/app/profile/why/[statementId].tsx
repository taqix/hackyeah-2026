import { useLocalSearchParams } from 'expo-router';

import { WhyScreen } from '@/features/profile/why-screen';

export default function WhyRoute() {
  const { statementId } = useLocalSearchParams<{ statementId: string }>();
  return <WhyScreen statementId={statementId} />;
}
