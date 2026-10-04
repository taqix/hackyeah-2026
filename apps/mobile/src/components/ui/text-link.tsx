import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type TextLinkProps = {
  children: string;
  onPress?: () => void;
  /** accent: blue with an arrow (Home's "See the chat"). quiet: secondary text, underlined. */
  tone?: 'accent' | 'quiet';
  /** Trailing icon; accent links default to arrow-right. Pass null for none. */
  icon?: IconName | null;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** A small text button: 44 high so it is easy to hit, no fill. */
export function TextLink({ children, onPress, tone = 'accent', icon, accessibilityHint, style }: TextLinkProps) {
  const { colors, fontFamily, radius } = useTheme();
  const color = tone === 'accent' ? colors.accentText : colors.textSecondary;
  const trailing = icon === undefined ? (tone === 'accent' ? 'arrow-right' : null) : icon;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={children}
      accessibilityHint={accessibilityHint}
      // The radius only rounds the web focus ring: the link has no fill.
      style={[
        { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, borderRadius: radius.xs },
        style,
      ]}>
      <Text
        style={{
          fontFamily: fontFamily.bodySemibold,
          fontSize: 14,
          lineHeight: 18,
          color,
          textDecorationLine: tone === 'quiet' ? 'underline' : 'none',
        }}>
        {children}
      </Text>
      {trailing ? <Icon name={trailing} size={16} color={color} /> : null}
    </PressableScale>
  );
}
