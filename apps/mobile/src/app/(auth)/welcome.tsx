import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function WelcomeRoute() {
  return (
    <PlaceholderScreen
      title="Welcome"
      screenId="1 · welcome"
      links={[
        { label: 'Continue with email', href: { pathname: '/password', params: { email: 'ana@example.com', mode: 'sign-in' } } },
        { label: 'Create account', href: { pathname: '/password', params: { email: 'new@example.com', mode: 'sign-up' } } },
      ]}
    />
  );
}
