import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function StartingRoute() {
  return (
    <PlaceholderScreen
      title="Where you are starting"
      screenId="2"
      links={[
        { label: 'Continue', href: '/onboarding/time' },
      ]}
    />
  );
}
