/**
 * The /coach route: the chat panel full screen over the tab it was opened
 * from (no tab bar). Its back arrow returns there.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';

import type { ChatRouteParams } from '@/navigation/routes';

import { ChatPanel } from './panel';

export function ChatScreen() {
  const params = useLocalSearchParams<ChatRouteParams>();
  const router = useRouter();
  return (
    <ChatPanel
      params={params}
      variant="page"
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
      }}
    />
  );
}
