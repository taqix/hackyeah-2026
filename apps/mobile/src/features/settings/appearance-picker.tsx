import { StyleSheet, View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { type Appearance, type ColorScheme, colors as schemes, useTheme } from '@/theme';

const OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

type AppearancePickerProps = {
  value: Appearance;
  onChange: (value: Appearance) => void;
};

/**
 * Settings › Appearance on the desktop web: one tile per choice, each a small
 * picture of the app in that theme (System shows both halves).
 */
export function AppearancePicker({ value, onChange }: AppearancePickerProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={styles.row}>
      {OPTIONS.map((option) => (
        <Tile key={option.value} option={option} on={option.value === value} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
}

function Tile({
  option,
  on,
  onPress,
}: {
  option: (typeof OPTIONS)[number];
  on: boolean;
  onPress: () => void;
}) {
  const { colors, radius, motion } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      aria-checked={on}
      style={({ hovered }) => [
        styles.tile,
        {
          borderRadius: radius.md,
          borderWidth: on ? 2 : 1,
          // A thinner edge sits 1 point further in: pad it so the picture doesn't move.
          padding: on ? 7 : 8,
          borderColor: on ? colors.accent : hovered ? colors.textTertiary : colors.borderStrong,
          backgroundColor: on ? colors.accentSoft : hovered ? colors.hoverWash : colors.surfaceCard,
        },
      ]}>
      <View style={[styles.preview, { borderRadius: radius.sm, borderColor: colors.borderSubtle }]}>
        {option.value === 'system' ? (
          <>
            <Picture scheme="light" />
            <Picture scheme="dark" />
          </>
        ) : (
          <Picture scheme={option.value} />
        )}
      </View>
      <View style={styles.label}>
        <View
          style={[
            styles.radio,
            on ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.borderStrong },
          ]}>
          {on ? <Icon name="check" size={11} strokeWidth={3} color={colors.textOnAccent} /> : null}
        </View>
        <Text variant="label" tone={on ? 'accent' : 'primary'}>
          {option.label}
        </Text>
      </View>
    </PressableScale>
  );
}

/** A tiny screen in one theme: paper, a card with two lines of text, and the accent. */
function Picture({ scheme }: { scheme: ColorScheme }) {
  const c = schemes[scheme];
  return (
    <View aria-hidden style={[styles.picture, { backgroundColor: c.bgApp }]}>
      <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.borderSubtle }]}>
        <View style={[styles.line, { width: '70%', backgroundColor: c.textPrimary }]} />
        <View style={[styles.line, styles.thin, { width: '45%', backgroundColor: c.textTertiary }]} />
      </View>
      <View style={[styles.pill, { backgroundColor: c.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: 128, minWidth: 0, gap: 10 },
  preview: { flexDirection: 'row', height: 76, overflow: 'hidden', borderWidth: 1 },
  picture: { flex: 1, padding: 10, gap: 8, overflow: 'hidden' },
  card: { borderRadius: 8, borderWidth: 1, padding: 8, gap: 5 },
  line: { height: 6, borderRadius: 3, opacity: 0.85 },
  thin: { height: 5 },
  pill: { width: 34, height: 10, borderRadius: 5 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
