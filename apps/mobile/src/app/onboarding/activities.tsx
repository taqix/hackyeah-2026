import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function ActivitiesRoute() {
  return (
    <PlaceholderScreen
      title="Activities"
      screenId="3.2"
      links={[
        { label: 'Continue', href: '/onboarding/places' },
      ]}
    />
  );
}
