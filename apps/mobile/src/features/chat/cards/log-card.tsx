/**
 * 8.16: a workout done outside the plan, added in a sentence. It is history,
 * not a plan session: every field shows as saved so a misreading is easy to
 * spot, Undo removes it and Edit opens the log-it form filled in.
 */
import { View } from 'react-native';

import { useSports } from '@/api/hooks';
import type { ChatMessage } from '@/api/types';
import { Button, Disc, Text } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { sportIcon } from '@/lib/sport-visuals';

import { logFacts, logWhen } from './format';
import { Band, Fine, Head, Small, Surface } from './parts';

type LogMessage = Extract<ChatMessage, { kind: 'workout_logged' }>;

export type LogCardProps = {
  message: LogMessage;
  busy: boolean;
  onUndo: (messageId: string) => void;
  onEditLog: (logId: string) => void;
};

export function LogCard({ message, busy, onUndo, onEditLog }: LogCardProps) {
  const { data: sports } = useSports();
  const today = useNow();
  const { log } = message;

  if (message.undone) {
    return (
      <Surface role="region" aria-label="Workout removed">
        <Band divider={false} style={{ paddingVertical: 16 }}>
          <Head icon="undo-2" tone="quiet" title="Workout removed" at={message.created_at} />
          <Small>Nothing from this message is saved.</Small>
        </Band>
      </Surface>
    );
  }

  const facts = logFacts(log, sports?.find((s) => s.id === log.sport_id));
  const when = logWhen(log, today);
  return (
    <Surface role="region" aria-label="Workout added">
      <Band divider={false} gap={12} style={{ paddingTop: 16, paddingBottom: 14 }}>
        <Head icon="check" tone="accent" title="Workout added" at={message.created_at} />
        <View accessible accessibilityLabel={`${log.title}, ${when}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Disc icon={sportIcon(log.sport_id)} tone="quiet" size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="bodyStrong">{log.title}</Text>
            <Text variant="caption">{when}</Text>
          </View>
        </View>
      </Band>
      <Band gap={10} style={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 14 }}>
        {facts.map((fact) => (
          <View
            key={fact.label}
            accessible
            accessibilityLabel={`${fact.label}: ${fact.value}`}
            style={{ flexGrow: 1, flexBasis: '30%', minWidth: 0, gap: 4 }}>
            <Text variant="caption">{fact.label}</Text>
            <Text variant="numeric" tabular style={{ fontSize: 18, lineHeight: 20 }}>
              {fact.value}
            </Text>
          </View>
        ))}
      </Band>
      <Band gap={12} style={{ paddingBottom: 14 }}>
        <Fine icon="lock">Your plan stays as it is.</Fine>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {message.can_undo ? (
            <Button
              size="sm"
              variant="secondary"
              icon="undo-2"
              disabled={busy}
              accessibilityLabel="Undo: remove this workout"
              onPress={() => onUndo(message.id)}>
              Undo
            </Button>
          ) : null}
          <View style={{ flex: 1 }} />
          <Button
            size="sm"
            variant="ghost"
            icon="pencil"
            accessibilityLabel="Edit this workout"
            onPress={() => onEditLog(log.id)}>
            Edit
          </Button>
        </View>
      </Band>
    </Surface>
  );
}
