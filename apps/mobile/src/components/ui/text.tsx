import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { type SemanticColors, type TypeVariant, useTheme } from '@/theme';

/** Text colors by role. Status colors as text use the *-text tokens (4.5:1 on every surface). */
export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'onAccent'
  | 'accent'
  | 'success'
  | 'danger'
  | 'info'
  | 'warm';

const TONE: Record<TextTone, keyof SemanticColors> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  inverse: 'textInverse',
  onAccent: 'textOnAccent',
  accent: 'accentText',
  success: 'successText',
  danger: 'dangerText',
  info: 'infoText',
  warm: 'warmText',
};

/** Default tone per variant, matching the prototype (captions tertiary, small text secondary). */
const DEFAULT_TONE: Partial<Record<TypeVariant, TextTone>> = {
  bodySm: 'secondary',
  caption: 'tertiary',
};

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Tabular numerals for times, weights and durations. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
};

/**
 * All app text. Variants are the design's type roles (hero, title, h1, heading,
 * subheading, body, bodyStrong, bodySm, section, label, caption, numeric).
 */
export function Text({ variant = 'body', tone, tabular, align, style, ...rest }: TextProps) {
  const theme = useTheme();
  const role = theme.type[variant];
  const color = theme.colors[TONE[tone ?? DEFAULT_TONE[variant] ?? 'primary']];
  return (
    <RNText
      {...rest}
      style={[
        role,
        { color },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
