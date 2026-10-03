import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type SuggestionTone = 'dusk' | 'dawn' | 'sage';

type Field = { color: string; rx: string; ry: string; cx: string; cy: string };

/*
 * Fixed hero palette from components.js: the card is dark in both themes, so its
 * colours do not come from the semantic tokens. Fields are listed bottom-up.
 */
const TONES: Record<SuggestionTone, { base: string; fields: Field[] }> = {
  dusk: {
    base: '#1B2A3A',
    fields: [
      { color: '#4C7FB8', rx: '40%', ry: '60%', cx: '55%', cy: '15%' },
      { color: '#C9894A', rx: '45%', ry: '70%', cx: '78%', cy: '65%' },
      { color: '#2C5E8C', rx: '60%', ry: '90%', cx: '18%', cy: '30%' },
    ],
  },
  dawn: {
    base: '#2A3550',
    fields: [
      { color: '#B4513C', rx: '40%', ry: '60%', cx: '50%', cy: '100%' },
      { color: '#5B8FD6', rx: '60%', ry: '90%', cx: '20%', cy: '70%' },
      { color: '#E7B58A', rx: '55%', ry: '80%', cx: '80%', cy: '30%' },
    ],
  },
  sage: {
    base: '#233024',
    fields: [
      { color: '#D9B37A', rx: '45%', ry: '70%', cx: '80%', cy: '60%' },
      { color: '#6E8460', rx: '60%', ry: '90%', cx: '25%', cy: '35%' },
    ],
  },
};

const INK = '#FBF8F2';
const INK_BODY = 'rgba(251,248,242,0.9)';
const INK_QUIET = 'rgba(251,248,242,0.92)';
const KICKER_FILL = 'rgba(251,248,242,0.18)';
const QUIET_PRESSED = 'rgba(251,248,242,0.14)';
const DISMISS_FILL = 'rgba(20,18,16,0.38)';
const PROTECTION = ['rgba(18,16,14,0)', 'rgba(18,16,14,0.25)', 'rgba(18,16,14,0.72)'] as const;

/** Light-on-dark colours for content passed as children (a progress bar on the hero). */
export const suggestionInk = {
  text: INK,
  body: INK_BODY,
  track: 'rgba(251,248,242,0.25)',
} as const;

/** Blurred colour fields: SVG radial gradients standing in for the CSS radial-gradient stack. */
function Fields({ tone }: { tone: SuggestionTone }) {
  const { base, fields } = TONES[tone];
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        {fields.map((f, i) => (
          <RadialGradient key={i} id={`suggestion-${tone}-${i}`} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fx={f.cx} fy={f.cy}>
            <Stop offset="0" stopColor={f.color} stopOpacity={1} />
            <Stop offset="0.7" stopColor={f.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={base} />
      {fields.map((_, i) => (
        <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#suggestion-${tone}-${i})`} />
      ))}
    </Svg>
  );
}

export type SuggestionCardProps = {
  tone?: SuggestionTone;
  kicker?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  /** One quiet text action beside the light button (Home's "Not today"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  onDismiss?: () => void;
  /** md: 220 min height, lg: 360. */
  size?: 'md' | 'lg';
  /** Rendered last, under the actions (a progress bar, a row). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The warm hero: colour fields, a bottom protection gradient and a bold display headline. */
export function SuggestionCard({
  tone = 'dusk',
  kicker,
  title,
  body,
  actionLabel,
  actionIcon,
  onAction,
  secondaryLabel,
  onSecondary,
  onDismiss,
  size = 'md',
  children,
  style,
}: SuggestionCardProps) {
  const { radius, fontFamily } = useTheme();
  const tall = size === 'lg';
  const titleSize = tall ? 34 : 27;

  return (
    <View style={[styles.card, { borderRadius: radius.xl, minHeight: tall ? 360 : 220 }, style]}>
      <Fields tone={tone} />
      <LinearGradient
        colors={PROTECTION}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {onDismiss ? (
        <PressableScale
          onPress={onDismiss}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.dismiss}>
          <Icon name="x" size={18} strokeWidth={2} color={INK} />
        </PressableScale>
      ) : null}
      <View style={[styles.content, { padding: tall ? 24 : 20 }]}>
        {kicker ? (
          <View style={styles.kicker}>
            <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 12, lineHeight: 14, color: INK }}>{kicker}</Text>
          </View>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fontFamily.displayBold,
            fontSize: titleSize,
            lineHeight: Math.round(titleSize * 1.08),
            letterSpacing: -0.02 * titleSize,
            color: INK,
          }}>
          {title}
        </Text>
        {body ? (
          <Text style={{ fontFamily: fontFamily.bodyRegular, fontSize: 15, lineHeight: 21, color: INK_BODY, maxWidth: 420 }}>
            {body}
          </Text>
        ) : null}
        {actionLabel || secondaryLabel ? (
          <View style={styles.actions}>
            {actionLabel ? (
              <Button variant="light" icon={actionIcon} onPress={onAction} style={styles.light}>
                {actionLabel}
              </Button>
            ) : null}
            {secondaryLabel ? (
              <PressableScale
                onPress={onSecondary}
                accessibilityRole="button"
                style={({ pressed }) => [styles.quiet, { backgroundColor: pressed ? QUIET_PRESSED : 'transparent' }]}>
                <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 20, color: INK_QUIET }}>
                  {secondaryLabel}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  content: { gap: 10 },
  kicker: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: KICKER_FILL,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  light: { height: 44, paddingHorizontal: 18 },
  quiet: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismiss: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DISMISS_FILL,
  },
});
