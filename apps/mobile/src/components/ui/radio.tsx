import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** 24 px ring; when checked, a 2 px accent border, a soft halo and a 12 px dot that springs in. */
function Indicator({ checked }: { checked: boolean }) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  return (
    <View style={[styles.halo, { backgroundColor: checked ? colors.accentSoftStrong : 'transparent' }]}>
      <View
        style={[
          styles.ring,
          {
            backgroundColor: colors.surfaceCard,
            borderWidth: checked ? 2 : 1.5,
            borderColor: checked ? colors.accent : colors.borderStrong,
          },
        ]}>
        <Animated.View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.accent,
            transform: [{ scale: checked ? 1 : 0 }],
            transitionProperty: 'transform',
            transitionDuration: reduced ? 0 : motion.durSlow,
            transitionTimingFunction: cubicBezier(...motion.easeSpring),
          }}
        />
      </View>
    </View>
  );
}

export type RadioProps = {
  label: string;
  description?: string;
  checked?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

function ChoiceText({ label, description, strong }: { label: string; description?: string; strong: boolean }) {
  const { fontFamily } = useTheme();
  return (
    <View style={styles.text}>
      <Text
        style={{
          fontFamily: strong ? fontFamily.bodySemibold : fontFamily.bodyMedium,
          fontSize: 16,
          lineHeight: 21,
        }}>
        {label}
      </Text>
      {description ? <Text variant="bodySm" tone="tertiary">{description}</Text> : null}
    </View>
  );
}

/** Radio as a plain row: indicator first, 48 high. Put it in a RadioGroup. */
export function Radio({ label, description, checked = false, disabled = false, onPress, style }: RadioProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      aria-checked={checked} aria-disabled={disabled}
      style={[styles.row, { alignItems: description ? 'flex-start' : 'center', opacity: disabled ? 0.45 : 1 }, style]}>
      <Indicator checked={checked} />
      <ChoiceText label={label} description={description} strong={false} />
    </PressableScale>
  );
}

/** Radio as a card (variant choices like "How did it feel?"): text first, indicator on the right. */
export function RadioCard({ label, description, checked = false, disabled = false, onPress, style }: RadioProps) {
  const { colors, radius } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      aria-checked={checked} aria-disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        {
          alignItems: description ? 'flex-start' : 'center',
          borderRadius: radius.md,
          backgroundColor: checked ? colors.accentSoft : pressed ? colors.surfaceSunken : colors.surfaceCard,
          borderWidth: checked ? 1.5 : 1,
          borderColor: checked ? colors.accent : colors.borderStrong,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}>
      <ChoiceText label={label} description={description} strong />
      <Indicator checked={checked} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  halo: {
    width: 32,
    height: 32,
    margin: -4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  row: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 48,
    paddingVertical: 10,
  },
  card: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 60,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
