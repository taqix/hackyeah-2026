import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type ExerciseMediaProps = {
  /** circle: the 52 px disc in ExerciseRow. rect: a full-width slot (4:3 by default). */
  shape?: 'circle' | 'rect';
  size?: number;
  aspectRatio?: number;
  icon?: IconName;
  /** Caption under the icon in the rect shape. */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Exercise image slot. Provider images are out of the MVP, so this is the quiet
 * placeholder: an icon on the sunken surface.
 */
export function ExerciseMedia({ shape = 'circle', size = 52, aspectRatio = 1, icon, label, style }: ExerciseMediaProps) {
  const { colors, radius } = useTheme();
  const circle = shape === 'circle';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        circle
          ? { width: size, height: size, borderRadius: size / 2 }
          : { width: '100%', aspectRatio, borderRadius: radius.card },
        {
          overflow: 'hidden',
          backgroundColor: colors.surfaceSunken,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        style,
      ]}>
      <Icon
        name={icon ?? (circle ? 'dumbbell' : 'film')}
        size={circle ? Math.round(size * 0.4) : 28}
        strokeWidth={1.5}
        color={colors.textTertiary}
      />
      {!circle ? <Text variant="caption">{label ?? 'Exercise animation'}</Text> : null}
    </View>
  );
}
