import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function PlacesRoute() {
  return (
    <PlaceholderScreen
      title="Places"
      screenId="3.3"
      links={[
        { label: 'Continue', href: '/onboarding/extras' },
      ]}
    />
  );
}
