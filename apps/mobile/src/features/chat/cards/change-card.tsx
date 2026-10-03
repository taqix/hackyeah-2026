/**
 * The change card (8.3–8.8): a validated revision, already the active plan.
 * One row per changed session, old values struck through next to the new ones,
 * what couldn't change with the reason, the lock line, Undo and See week.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { useSports } from '@/api/hooks';
import type { ChangeRow, ChatMessage } from '@/api/types';
import { Badge, Button, Disc, Icon, IconButton, PressableScale, Text } from '@/components/ui';
import { toLocalDate } from '@/lib/dates';
import { useNow } from '@/lib/clock';
import { sportIcon, sportName } from '@/lib/sport-visuals';
import { useTheme } from '@/theme';

import { diffView, rowDay, rowSpeech, stampLabel } from './format';
import { Band, Diff, Fine, Head, Small, Stamp, Surface } from './parts';

type ChangeMessage = Extract<ChatMessage, { kind: 'change' }>;

export type ChangeCardProps = {
  message: ChangeMessage;
  busy: boolean;
  /** Earlier days' cards start folded: summary only, tap to expand. */
  folded?: boolean;
  onUndo: (messageId: string) => void;
  onSeeWeek: (date: string) => void;
};

function SportRow({ from, to }: { from: string; to: string }) {
  const { data: sports } = useSports();
  return (
    <Band style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44 }}>
        <Disc icon={sportIcon(to)} size={36} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="caption" importantForAccessibility="no" accessibilityElementsHidden>
          Sport
        </Text>
        <Diff view={{ what: 'Sport', from: sportName(sports, from), to: sportName(sports, to) }} size={16} />
      </View>
    </Band>
  );
}

/** One changed session. The day column shows where the session is now. */
function SessionRow({ row }: { row: ChangeRow }) {
  const { colors, fontFamily } = useTheme();
  const today = useNow();
  const removed = row.kind === 'removed';
  const day = rowDay(row.date, today);
  return (
    <Band accessible accessibilityLabel={rowSpeech(row)} gap={0} style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 44, gap: 3, paddingTop: 2 }}>
        <Text
          style={{
            fontFamily: fontFamily.bodySemibold,
            fontSize: 15,
            lineHeight: 18,
            color: removed ? colors.textTertiary : colors.textPrimary,
          }}>
          {day.day}
        </Text>
        <Text variant="caption">{day.date}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            {row.was_title ? (
              <Text variant="bodySm" tone="tertiary" style={{ textDecorationLine: 'line-through' }}>
                {row.was_title}
              </Text>
            ) : null}
            <Text
              style={{
                fontFamily: fontFamily.bodySemibold,
                fontSize: 16,
                lineHeight: 21,
                color: removed ? colors.textTertiary : colors.textPrimary,
                textDecorationLine: removed ? 'line-through' : 'none',
              }}>
              {row.title}
            </Text>
          </View>
          {row.kind === 'added' ? <Badge tone="accent">New</Badge> : removed ? <Badge>Removed</Badge> : null}
        </View>
        {row.diffs.map((diff) => (
          <Diff key={diff.field} view={diffView(diff)} />
        ))}
        {row.note ? <Small>{row.note}</Small> : null}
      </View>
    </Band>
  );
}

/** Part of a request that was not applied, and why. */
function NotChangedRow({ title, reason }: { title: string; reason: string }) {
  return (
    <Band accessible accessibilityLabel={`Not changed: ${title}. ${reason}`} gap={0} style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 44 }}>
        <Disc icon="info" tone="info" size={28} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Small>{reason}</Small>
      </View>
    </Band>
  );
}

/** An earlier change, folded (8.8). Tap to see its rows again. */
function PastChange({ message, onExpand }: { message: ChangeMessage; onExpand: () => void }) {
  const { colors, radius } = useTheme();
  const current = useNow();
  const { change } = message;
  const title = change.undone ? 'Change undone' : 'Plan updated';
  return (
    <PressableScale
      onPress={onExpand}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${stampLabel(message.created_at, current)}. ${change.summary}`}
      accessibilityHint="Shows what changed"
      aria-expanded={false}
      style={({ pressed }) => ({
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.surfaceSunken : colors.surfaceCard,
      })}>
      <Disc icon={change.undone ? 'undo-2' : 'check'} tone={change.undone ? 'quiet' : 'accent'} size={28} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Stamp at={message.created_at} />
        </View>
        <Small>{change.summary}</Small>
      </View>
      <Icon name="chevron-down" size={18} color={colors.textTertiary} />
    </PressableScale>
  );
}

/** Folds an expanded earlier change again. */
function FoldButton({ onFold }: { onFold?: () => void }) {
  if (!onFold) return null;
  return <IconButton icon="chevron-up" size="sm" accessibilityLabel="Fold this change" onPress={onFold} />;
}

/** Undone in place (8.4): the plan before this change is back. */
function UndoneCard({ message, onFold }: { message: ChangeMessage; onFold?: () => void }) {
  return (
    <Surface role="region" aria-label="Change undone">
      <Band divider={false} style={{ paddingVertical: 16 }}>
        <Head icon="undo-2" tone="quiet" title="Change undone" at={message.created_at} trailing={<FoldButton onFold={onFold} />} />
        {message.change.summary ? <Small>{message.change.summary}</Small> : null}
      </Band>
    </Surface>
  );
}

function FullCard({ message, busy, onUndo, onSeeWeek, onFold }: Omit<ChangeCardProps, 'folded'> & { onFold?: () => void }) {
  const { change } = message;
  const seeWeekDate = change.rows[0]?.date ?? toLocalDate(message.created_at);
  return (
    <Surface role="region" aria-label="Plan updated">
      <Band divider={false} style={{ paddingTop: 16, paddingBottom: 14 }}>
        <Head
          icon="check"
          tone="accent"
          title="Plan updated"
          at={message.created_at}
          trailing={<FoldButton onFold={onFold} />}
        />
        {change.summary ? <Small>{change.summary}</Small> : null}
      </Band>
      {change.sport_switch ? <SportRow from={change.sport_switch.from} to={change.sport_switch.to} /> : null}
      {change.rows.map((row) => (
        <SessionRow key={`${row.session_id}-${row.kind}`} row={row} />
      ))}
      {change.not_changed.map((item) => (
        <NotChangedRow key={item.title} title={item.title} reason={item.reason} />
      ))}
      <Band gap={12} style={{ paddingBottom: 14 }}>
        {change.kept ? <Fine icon="lock">{change.kept}</Fine> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {change.can_undo ? (
            <Button
              size="sm"
              variant="secondary"
              icon="undo-2"
              disabled={busy}
              accessibilityLabel="Undo this change"
              accessibilityHint="Brings back the plan before this change"
              onPress={() => onUndo(message.id)}>
              Undo
            </Button>
          ) : null}
          <View style={{ flex: 1 }} />
          <Button
            size="sm"
            variant="ghost"
            iconRight="arrow-right"
            accessibilityHint="Opens Today on the changed week"
            onPress={() => onSeeWeek(seeWeekDate)}>
            See week
          </Button>
        </View>
      </Band>
    </Surface>
  );
}

export function ChangeCard({ message, busy, folded = false, onUndo, onSeeWeek }: ChangeCardProps) {
  const [expanded, setExpanded] = useState(false);
  if (folded && !expanded) return <PastChange message={message} onExpand={() => setExpanded(true)} />;
  const onFold = folded ? () => setExpanded(false) : undefined;
  if (message.change.undone) return <UndoneCard message={message} onFold={onFold} />;
  return <FullCard message={message} busy={busy} onUndo={onUndo} onSeeWeek={onSeeWeek} onFold={onFold} />;
}
