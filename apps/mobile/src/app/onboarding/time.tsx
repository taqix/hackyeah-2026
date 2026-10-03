import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function TimeRoute() {
  return (
    <PlaceholderScreen
      title="Your time"
      screenId="3.1"
      links={[
        { label: 'Continue', href: '/onboarding/activities' },
      ]}
    />
  );
}
