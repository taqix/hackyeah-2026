/**
 * Chat cards: everything drawn inside the thread (design/prototype/chat.jsx).
 *
 * INTERFACE STUB. The chat screen (src/features/chat/screen) renders these;
 * the chat-cards work replaces the bodies with the designed components. Keep
 * the exported names and props stable: both sides code against them.
 */
import { View } from 'react-native';

import type { ChatMessage } from '@/api/types';
import { Text } from '@/components/ui/text';

export type ChatMessageViewProps = {
  message: ChatMessage;
  /** The newest coach message: only it keeps live quick replies and the quiet option. */
  isLatest: boolean;
  /** A request is running (one change at a time): quick replies and Undo are disabled. */
  busy: boolean;
  /** Earlier days' change cards render folded (8.8): summary only, tap to expand. */
  folded?: boolean;
  /** Sends the text at once (quick replies and the quiet option). */
  onQuickReply: (text: string) => void;
  /** Undo on a change card or a logged workout card. */
  onUndo: (messageId: string) => void;
  /** "See week" on a change card: opens Today on the changed week. */
  onSeeWeek: (date: string) => void;
  /** "Edit" on a logged workout card: opens the log-it form filled in. */
  onEditLog: (logId: string) => void;
};

/** One message: user bubble, coach reply, change card or logged-workout card. */
export function ChatMessageView({ message }: ChatMessageViewProps) {
  return (
    <View>
      <Text>{message.kind === 'text' || message.kind === 'reply' ? message.text : message.kind}</Text>
    </View>
  );
}

/** 8.2: spinner, skeleton rows and "Your current plan stays as it is until the new one is ready." */
export function UpdatingCard() {
  return <Text accessibilityRole="progressbar">Updating your plan…</Text>;
}

export type ProblemKind = 'failed' | 'stale' | 'offline';

export type ProblemCardProps = {
  /** failed: 8.12, stale: 8.13 (changed elsewhere), offline: 8.14 (message waits, unsent). */
  kind: ProblemKind;
  /** Try again resends the message. */
  onRetry: () => void;
  /** Edit message puts it back in the box. */
  onEdit: () => void;
};

/** Both say the plan is as it was and offer Try again. Announced as an alert. */
export function ProblemCard({ kind }: ProblemCardProps) {
  return <Text accessibilityRole="alert">{kind}</Text>;
}

/** A day separator in the thread ("Yesterday", "Wednesday 7 October"). */
export function DayBreak({ label }: { label: string }) {
  return <Text variant="caption">{label}</Text>;
}
