import { type StyleProp, View, type ViewStyle } from 'react-native';

import { type SemanticColors, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type BadgeTone = 'neutral' | 'accent' | 'recovery' | 'success' | 'danger' | 'info' | 'warm';

const TONES: Record<BadgeTone, [keyof SemanticColors, keyof SemanticColors]> = {
  neutral: ['surfaceSunken', 'textSecondary'],
  accent: ['accentSoftStrong', 'accentText'],
  recovery: ['recoverySoft', 'textSecondary'],
  success: ['successSoft', 'successText'],
  danger: ['dangerSoft', 'dangerText'],
  info: ['infoSoft', 'infoText'],
  warm: ['tintPeach', 'warmText'],
};

export type BadgeProps = {
  children: string;
  tone?: BadgeTone;
  /** A 6 px status dot before the text. */
  dot?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

/** Small status pill: 24 high, caption text. */
export function Badge({ children, tone = 'neutral', dot = false, icon, style }: BadgeProps) {
  const { colors } = useTheme();
  const [bg, fg] = TONES[tone];
  const dotColor = tone === 'recovery' ? colors.recovery : colors[fg];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          height: 24,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors[bg],
        },
        style,
      ]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} /> : null}
      {icon ? <Icon name={icon} size={14} color={colors[fg]} strokeWidth={2} /> : null}
      <Text variant="caption" numberOfLines={1} style={{ color: colors[fg] }}>
        {children}
      </Text>
    </View>
  );
}
