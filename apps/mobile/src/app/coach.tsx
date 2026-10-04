import { ChatScreen } from '@/features/chat/screen';
import { useCoachDock } from '@/navigation/web/coach-dock';
import { OpenCoachInDock } from '@/navigation/web/open-coach-in-dock';

/**
 * Chat 8: full screen over the tab it opened from, no tab bar. Params: prefill, about, intent=move.
 * The desktop web opens the same request in the coach dock beside the page instead.
 */
export default function CoachRoute() {
  const dock = useCoachDock();
  return dock.available ? <OpenCoachInDock /> : <ChatScreen />;
}
