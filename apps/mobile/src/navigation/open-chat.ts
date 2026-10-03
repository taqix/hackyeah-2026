import { useRouter } from 'expo-router';

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
 * The only way to open chat: full screen over the current screen, from the chat
 * button beside the tab bar or from any entry point that fills or attaches something.
 */
export function useOpenChat() {
  const router = useRouter();
  return (options: OpenChatOptions = {}) => {
    const params = chatParams(options);
    router.push({ pathname: '/coach', params });
  };
}
