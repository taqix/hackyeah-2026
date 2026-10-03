import { useRouter } from 'expo-router';

import { useChatPlacement } from './chat-placement';
import type { ChatRouteParams } from './routes';

export type OpenChatOptions = {
  /** Text placed in the message box, not sent. */
  prefill?: string;
  /** The session the conversation is about. */
  aboutSessionId?: string;
  intent?: 'move';
};

function chatParams({ prefill, aboutSessionId, intent }: OpenChatOptions): ChatRouteParams {
  return {
    ...(prefill ? { prefill } : null),
    ...(aboutSessionId ? { about: aboutSessionId } : null),
    ...(intent ? { intent } : null),
  };
}

/**
 * The only way to open chat. Tab placement switches to the Chat tab; button
 * placement opens chat full screen over the current screen.
 */
export function useOpenChat() {
  const router = useRouter();
  const [placement] = useChatPlacement();
  return (options: OpenChatOptions = {}) => {
    const params = chatParams(options);
    if (placement === 'button') {
      router.push({ pathname: '/coach', params });
    } else {
      router.navigate({ pathname: '/(tabs)/chat', params });
    }
  };
}
