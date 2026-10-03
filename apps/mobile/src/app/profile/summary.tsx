import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function SummaryRoute() {
  return (
    <PlaceholderScreen
      title="How we see you"
      screenId="9.2"
      links={[
        { label: 'Why we think this', href: routes.why('demo-statement') },
      ]}
    />
  );
}
