import { type StyleProp, View, type ViewStyle } from 'react-native';

import { type SemanticColors, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { Spin } from './spinner';

export type DiscTone = 'accent' | 'success' | 'recovery' | 'warm' | 'info' | 'danger' | 'quiet';

const TONES: Record<DiscTone, [keyof SemanticColors, keyof SemanticColors]> = {
  accent: ['accentSoft', 'accentText'],
  success: ['successSoft', 'success'],
  recovery: ['recoverySoft', 'recovery'],
  warm: ['tintPeach', 'warmText'],
  info: ['infoSoft', 'info'],
  danger: ['dangerSoft', 'danger'],
  quiet: ['surfaceSunken', 'textSecondary'],
};

export type DiscProps = {
  icon: IconName;
  tone?: DiscTone;
  /** Diameter; the icon is half of it. 40 on profile rows, 32 in chat. */
  size?: number;
  /** Spins the icon: the busy indicator (use with loader-circle). */
  spin?: boolean;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/** An icon in a tinted circle. Decorative: label the row around it. */
export function Disc({ icon, tone = 'accent', size = 40, spin = false, strokeWidth, style }: DiscProps) {
  const { colors } = useTheme();
  const [bg, fg] = TONES[tone];
  const glyph = <Icon name={icon} size={Math.round(size / 2)} color={colors[fg]} strokeWidth={strokeWidth} />;
  return (
    <View
      aria-hidden
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors[bg],
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      {spin ? <Spin>{glyph}</Spin> : glyph}
    </View>
  );
}
