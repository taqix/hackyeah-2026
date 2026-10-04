import { StyleSheet, View } from 'react-native';

import { Badge, Disc, type DiscTone, Icon, type IconName, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { type MarkState, stateWord } from './day-items';

const DISC: Record<MarkState, DiscTone> = { done: 'success', planned: 'accent', unlogged: 'quiet', skipped: 'quiet' };

export type SessionLineProps = {
  /** The sport's icon. */
  icon: IconName;
  title: string;
  /** Optional, Extra. */
  tags: string[];
  /** "7:00 · 20 min · felt easy", read out with commas. */
  meta: string;
  state: MarkState;
  hint: string;
  onPress: () => void;
};

/**
 * A session on the desktop panels: the sport, the title and its line of
 * facts, and how it went (Done, Skipped, Not logged) or a chevron while it is
 * still ahead. The whole line opens it; the mouse washes it on hover.
 */
export function SessionLine({ icon, title, tags, meta, state, hint, onPress }: SessionLineProps) {
  const { colors, radius } = useTheme();
  const label = [title, ...tags, meta.split(' · ').join(', '), stateWord(state)].filter(Boolean).join(', ');
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed, hovered }) => [
        styles.line,
        { borderRadius: radius.sm },
        (hovered || pressed) && { backgroundColor: colors.hoverWash },
      ]}>
      <Disc icon={icon} tone={DISC[state]} size={40} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong" tone={state === 'planned' ? 'primary' : 'secondary'}>
            {title}
          </Text>
          {tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </View>
        <Text variant="caption" tone="secondary" tabular>
          {meta}
        </Text>
      </View>
      {state === 'done' ? (
        <Badge tone="success" dot>
          Done
        </Badge>
      ) : state === 'unlogged' ? (
        <Badge>Not logged</Badge>
      ) : state === 'skipped' ? (
        <Badge>Skipped</Badge>
      ) : (
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingVertical: 8,
    // The hover wash reaches past the text into the card's padding.
    paddingHorizontal: 10,
    marginHorizontal: -10,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
