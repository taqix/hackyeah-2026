import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function PasswordRoute() {
  return (
    <PlaceholderScreen
      title="Password"
      screenId="1.1 / 1.2 / 1.3"
      links={[
        { label: 'Continue to onboarding', href: '/onboarding/starting', replace: true },
      ]}
    />
  );
}
