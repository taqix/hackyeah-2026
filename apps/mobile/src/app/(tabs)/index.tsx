import { useOpenChat } from '@/navigation/open-chat';
import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function TodayRoute() {
  const openChat = useOpenChat();
  return (
    <PlaceholderScreen
      title="Today"
      screenId="5"
      tab
      links={[
        { label: 'Open a session', href: routes.session('demo-session') },
        { label: 'Start a gym session', href: routes.gym('demo-gym') },
        { label: 'Log a workout', href: routes.log('new') },
        { label: 'Move this session in chat', onPress: () => openChat({ aboutSessionId: 'demo-session', intent: 'move' }) },
      ]}
    />
  );
}
