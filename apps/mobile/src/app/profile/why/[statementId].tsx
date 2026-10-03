import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function WhyRoute() {
  return (
    <PlaceholderScreen
      title="Why we think this"
      screenId="9.3"
      links={[
        { label: 'Change this answer', href: routes.profileEdit('time') },
      ]}
    />
  );
}
