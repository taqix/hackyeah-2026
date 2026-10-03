import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function LogRoute() {
  return (
    <PlaceholderScreen
      title="Log it"
      screenId="6.1 / 6.2 / 6.9 / 6.10"
      links={[
        { label: 'Save', href: routes.feedback('demo-log'), replace: true },
      ]}
    />
  );
}
