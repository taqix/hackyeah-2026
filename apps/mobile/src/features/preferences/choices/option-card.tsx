import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { Icon, type IconName, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

type Kind = 'radio' | 'checkbox';

export type OptionCardProps = {
  /** One choice of a group (radio) or any number of them (checkbox). */
  kind: Kind;
  label: string;
  description?: string;
  icon?: IconName;
  /**
   * inline: icon, words and mark in one row. stacked: icon and mark above the
   * words, for a few large choices.
   */
  layout?: 'inline' | 'stacked';
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** The radio's dot or the checkbox's tick, in the card's corner; hover darkens it as on the kit's rows. */
function Mark({ kind, selected, hovered }: { kind: Kind; selected: boolean; hovered: boolean }) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const edge = hovered ? colors.textTertiary : colors.borderStrong;
  if (kind === 'checkbox') {
    return (
      <View
        style={[
          styles.box,
          {
            backgroundColor: selected ? (hovered ? colors.accentHover : colors.accent) : colors.surfaceCard,
            borderWidth: selected ? 0 : 1.5,
            borderColor: edge,
          },
        ]}>
        {selected ? <Icon name="check" size={14} strokeWidth={2.5} color={colors.textOnAccent} /> : null}
      </View>
    );
  }
  return (
    <View
      style={[
        styles.ring,
        {
          backgroundColor: colors.surfaceCard,
          borderWidth: selected ? 2 : 1.5,
          borderColor: selected ? colors.accent : edge,
        },
      ]}>
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: colors.accent,
            transform: [{ scale: selected ? 1 : 0 }],
            transitionProperty: 'transform',
            transitionDuration: reduced ? 0 : motion.durSlow,
            transitionTimingFunction: cubicBezier(...motion.easeSpring),
          },
        ]}
      />
    </View>
  );
}

/** The option's icon in a soft circle that turns blue with the choice. */
function Glyph({ icon, selected, size }: { icon: IconName; selected: boolean; size: number }) {
  const { colors } = useTheme();
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.accentSoftStrong : colors.surfaceSunken,
      }}>
      <Icon name={icon} size={Math.round(size / 2)} color={selected ? colors.accentText : colors.textSecondary} />
    </View>
  );
}

/**
 * A choice as a card, for the desktop web where the phone's radio cards, tags
 * and checkbox rows would run in one long column: put several in a TileGrid.
 * Like the kit's RadioCard, it sinks a step when hovered or pressed and turns
 * blue when chosen; keyboard focus shows the kit's ring.
 */
export function OptionCard({
  kind,
  label,
  description,
  icon,
  layout = 'inline',
  selected,
  disabled = false,
  onPress,
}: OptionCardProps) {
  const { colors, radius, fontFamily } = useTheme();
  const stacked = layout === 'stacked';

  const words = (
    <View style={styles.words}>
      <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 21 }}>{label}</Text>
      {description ? (
        <Text variant="bodySm" tone="tertiary">
          {description}
        </Text>
      ) : null}
    </View>
  );
  const glyph = icon ? <Glyph icon={icon} selected={selected} size={36} /> : null;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityRole={kind}
      accessibilityLabel={description ? `${label}, ${description}` : label}
      aria-checked={selected}
      aria-disabled={disabled}
      style={({ pressed, hovered }) => [
        styles.card,
        stacked ? styles.stacked : styles.inline,
        {
          borderRadius: radius.md,
          backgroundColor: selected ? colors.accentSoft : pressed || hovered ? colors.surfaceSunken : colors.surfaceCard,
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? colors.accent : colors.borderStrong,
          opacity: disabled ? 0.45 : 1,
        },
      ]}>
      {({ hovered }) =>
        stacked ? (
          <>
            <View style={styles.top}>
              {glyph}
              <Mark kind={kind} selected={selected} hovered={hovered} />
            </View>
            {words}
          </>
        ) : (
          <>
            {glyph}
            {words}
            <Mark kind={kind} selected={selected} hovered={hovered} />
          </>
        )
      }
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1 },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  stacked: {
    gap: 14,
    minHeight: 104,
    padding: 16,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  words: { flex: 1, minWidth: 0, gap: 2 },
  box: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
