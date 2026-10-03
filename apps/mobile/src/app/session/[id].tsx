import { useLocalSearchParams } from 'expo-router';

import { useOpenChat } from '@/navigation/open-chat';
import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function SessionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const openChat = useOpenChat();
  return (
    <PlaceholderScreen
      title="Activity"
      screenId="6"
      links={[
        { label: 'Log it', href: routes.log(id) },
        { label: 'Start (gym)', href: routes.gym(id) },
        { label: 'Adjust in chat', onPress: () => openChat({ aboutSessionId: id }) },
      ]}
    />
  );
}
