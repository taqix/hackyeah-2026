import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { LocalDate, PlannedSession } from '@/api/types';
import { type IconName, ListRow, Sheet, TextLink } from '@/components/ui';
import { formatMinutes, relativeDayName } from '@/lib/dates';
import { sessionLocalDate, sessionMinutes } from '@/lib/sessions';
import { type OpenChatOptions, useOpenChat } from '@/navigation/open-chat';
import { useTheme } from '@/theme';

import { inSentence } from './copy';

type Option = { icon: IconName; title: string; detail: string; prefill: string };

/** home.jsx NOT_TODAY: simpler, five minutes, move, or skip with nothing to make up. */
function notTodayOptions(session: PlannedSession, nextSession: PlannedSession | null, today: LocalDate): Option[] {
  const what = inSentence(session.title);
  const length = formatMinutes(sessionMinutes(session));
  const next = nextSession ? relativeDayName(sessionLocalDate(nextSession), today) : null;
  return [
    {
      icon: 'feather',
      title: 'Make it simpler',
      detail: `A gentler version, still ${length}.`,
      prefill: `Can you make today's ${what} simpler? A gentler version, still ${length}.`,
    },
    {
      icon: 'timer',
      title: 'Five minutes instead',
      detail: 'A short version. It still counts.',
      prefill: `Can I do five minutes of ${what} today instead?`,
    },
    {
      icon: 'calendar-clock',
      title: 'Move it',
      detail: 'To later today or another free day.',
      prefill: `Can you move today's ${what} to later today or another free day?`,
    },
    {
      icon: 'moon',
      title: 'Skip today',
      detail: next ? `Nothing to make up. ${next} stays as planned.` : 'Nothing to make up.',
      prefill: `I'd like to skip today's ${what}.`,
    },
  ];
}

export type NotTodaySheetProps = {
  visible: boolean;
  onClose: () => void;
  session: PlannedSession;
  nextSession: PlannedSession | null;
  today: LocalDate;
};

/**
 * 5.2: alternatives to today's session instead of a guilt trip. Each opens chat
 * with the request filled in and the session attached; chat proposes the change.
 */
export function NotTodaySheet({ visible, onClose, session, nextSession, today }: NotTodaySheetProps) {
  const openChat = useOpenChat();
  const { motion } = useTheme();
  const reduced = useReducedMotion();

  // Chat is a full-screen modal: let the sheet finish closing before it is presented.
  const toChat = (options: OpenChatOptions) => {
    onClose();
    setTimeout(() => openChat(options), reduced ? 80 : motion.durSlow + 60);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      label="Not today"
      title="Not today?"
      description="Pick what helps. The rest of your week stays as it is.">
      <View>
        {notTodayOptions(session, nextSession, today).map((option, i) => (
          <ListRow
            key={option.title}
            icon={option.icon}
            discTone="quiet"
            discSize={44}
            title={option.title}
            detail={option.detail}
            divider={i > 0}
            accessibilityHint="Opens chat with this request filled in"
            onPress={() => toChat({ prefill: option.prefill, aboutSessionId: session.id })}
            style={{ minHeight: 64, paddingHorizontal: 4 }}
          />
        ))}
      </View>
      <TextLink
        onPress={() => toChat({ aboutSessionId: session.id })}
        accessibilityHint="Opens chat about this session"
        style={{ marginLeft: 4 }}>
        Something else? Ask in chat
      </TextLink>
    </Sheet>
  );
}
