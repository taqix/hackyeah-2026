import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function CalendarRoute() {
  return (
    <PlaceholderScreen
      title="Calendar"
      screenId="10"
      tab
      links={[
        { label: 'Open a session', href: routes.session('demo-session') },
        { label: 'Plan history', href: '/plan-history' },
      ]}
    />
  );
}
