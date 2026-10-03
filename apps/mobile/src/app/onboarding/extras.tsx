import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function ExtrasRoute() {
  return (
    <PlaceholderScreen
      title="Good to know"
      screenId="3.4"
      links={[
        { label: 'Continue', href: '/onboarding/review' },
      ]}
    />
  );
}
