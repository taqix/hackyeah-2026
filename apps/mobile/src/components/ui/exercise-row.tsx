import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { ExerciseMedia } from './exercise-media';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type ExerciseRowProps = {
  name: string;
  /** "3 × 10 · 8 kg", "4 min". */
  detail?: string;
  /** Quieter text after the detail ("warm-up"). */
  meta?: string;
  /** Shows the icon disc before the text. */
  media?: boolean;
  mediaIcon?: IconName;
  /** Ticked off: dims the row and fills the check. */
  done?: boolean;
  /** Adds the round check button at the right. */
  onToggle?: () => void;
  /** Makes the text area open the exercise. */
  onPress?: () => void;
  /** Hairline under the row. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ExerciseRow({
  name,
  detail,
  meta,
  media = false,
  mediaIcon,
  done = false,
  onToggle,
  onPress,
  divider = true,
  style,
}: ExerciseRowProps) {
  const { colors, fontFamily, motion } = useTheme();
  const reduced = useReducedMotion();

  const body = (
    <>
      {media ? <ExerciseMedia icon={mediaIcon} style={{ opacity: done ? 0.5 : 1 }} /> : null}
      <View style={styles.text}>
        <Text
          style={{
            fontFamily: fontFamily.bodySemibold,
            fontSize: 16,
            lineHeight: 21,
            color: done ? colors.textTertiary : colors.textPrimary,
          }}>
          {name}
        </Text>
        {detail || meta ? (
          <Text variant="bodySm" tabular>
            {detail}
            {detail && meta ? <Text variant="bodySm" tone="tertiary">{` · ${meta}`}</Text> : meta}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.row,
        divider ? { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle } : null,
        style,
      ]}>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          scaleTo={motion.pressScaleCard}
          accessibilityRole="button"
          style={styles.main}>
          {body}
        </PressableScale>
      ) : (
        <View style={styles.main}>{body}</View>
      )}
      {onToggle ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityLabel={name}
          aria-checked={done}
          style={styles.toggle}>
          <Animated.View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: done ? colors.accent : 'transparent',
              borderWidth: 1.5,
              borderColor: done ? colors.accent : colors.borderStrong,
              transform: [{ scale: done ? 1 : 0.96 }],
              transitionProperty: ['transform', 'backgroundColor', 'borderColor'],
              transitionDuration: reduced ? 0 : motion.durSlow,
              transitionTimingFunction: cubicBezier(...motion.easeSpring),
            }}>
            {done ? <Icon name="check" size={15} strokeWidth={2.5} color={colors.textOnAccent} /> : null}
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingVertical: 12,
  },
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  toggle: {
    width: 44,
    height: 44,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
