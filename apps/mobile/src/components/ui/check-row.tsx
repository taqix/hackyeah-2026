import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type CheckRowProps = {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** One option of a "pick any" list: a square check, same rhythm as the Radio row. */
export function CheckRow({ label, checked, onPress, disabled = false, style }: CheckRowProps) {
  const { colors, fontFamily } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, paddingVertical: 10 },
        disabled ? { opacity: 0.45 } : null,
        style,
      ]}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? colors.accent : colors.surfaceCard,
          borderWidth: checked ? 0 : 1.5,
          borderColor: colors.borderStrong,
        }}>
        {checked ? <Icon name="check" size={15} strokeWidth={2.5} color={colors.textOnAccent} /> : null}
      </View>
      <Text style={{ flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 16, lineHeight: 21 }}>{label}</Text>
    </PressableScale>
  );
}
