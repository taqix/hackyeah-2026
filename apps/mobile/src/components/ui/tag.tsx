import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type TagProps = {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Selectable chip for multiple choice (DS Tag): inverse fill when selected. */
export function Tag({ label, icon, selected = false, onPress, disabled = false, style }: TagProps) {
  const { colors } = useTheme();
  const fg = selected ? colors.textInverse : colors.textPrimary;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 2, bottom: 2 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={selected} aria-disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 40,
          paddingHorizontal: 16,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected ? colors.surfaceInverse : colors.borderStrong,
          backgroundColor: selected ? colors.surfaceInverse : pressed ? colors.surfaceSunken : colors.surfaceCard,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}>
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="label" numberOfLines={1} style={{ color: fg }}>
        {label}
      </Text>
    </PressableScale>
  );
}
