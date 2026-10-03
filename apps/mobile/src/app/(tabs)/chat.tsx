import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function ChatRoute() {
  return (
    <PlaceholderScreen
      title="Coach"
      screenId="8 · tab" tab
      links={[
        { label: 'Open a session', href: routes.session('demo-session') },
      ]}
    />
  );
}
