import type { PlanVersion } from '@/api/types';
import { useOpenChat } from '@/navigation/open-chat';

export type VersionAction = { label: string; hint: string; onPress: () => void };

/** Chat and undo versions point back to the change card in the conversation. */
export function useVersionAction(): (version: PlanVersion) => VersionAction | null {
  const openChat = useOpenChat();
  return (version) =>
    version.chat_message_id ? { label: 'See the chat', hint: 'Opens the chat', onPress: () => openChat() } : null;
}
