import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { type SemanticColors, useTheme } from '@/theme';

/** Tinted hero tones (home.jsx HERO): sage for rest, moss for done, peach for a finished week. */
export type HeroTone = 'rest' | 'done' | 'warm' | 'quiet';

const TONES: Record<HeroTone, { bg: keyof SemanticColors; fg: keyof SemanticColors }> = {
  rest: { bg: 'tintSage', fg: 'recovery' },
  done: { bg: 'successSoft', fg: 'success' },
  warm: { bg: 'tintPeach', fg: 'warmText' },
  quiet: { bg: 'surfaceSunken', fg: 'textSecondary' },
};

export type HeroCardProps = {
  tone?: HeroTone;
  icon: IconName;
  kicker: string;
  title: string;
  body?: string | null;
  /** Buttons in a wrapping row under the body. */
  actions?: ReactNode;
  children?: ReactNode;
};

/**
 * The hero for days without a session to start. Same slot, radius and title
 * scale as SuggestionCard, so the top of Home keeps its shape.
 */
export function HeroCard({ tone = 'quiet', icon, kicker, title, body, actions, children }: HeroCardProps) {
  const { colors, radius, fontFamily } = useTheme();
  const t = TONES[tone];

  return (
    <View style={[styles.card, { borderRadius: radius.xl, backgroundColor: colors[t.bg] }]}>
      <View style={styles.kicker}>
        {/* The prototype mixes the card surface at 72% over the tint. */}
        <View style={[StyleSheet.absoluteFill, styles.kickerFill, { backgroundColor: colors.surfaceCard }]} />
        <Icon name={icon} size={14} strokeWidth={2} color={colors[t.fg]} />
        <Text
          style={{ fontFamily: fontFamily.bodySemibold, fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
          {kicker}
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fontFamily.displayBold, fontSize: 27, lineHeight: 29, letterSpacing: -0.54, color: colors.textPrimary }}>
        {title}
      </Text>
      {body ? (
        <Text variant="bodySm" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
      {children}
    </View>
  );
}

/** A row under the body, set off by a hairline (the week's reason, the next session). */
export function HeroFootnote({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.footnote, { borderTopColor: colors.hairlineOnTint }]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 10 },
  kicker: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  kickerFill: { opacity: 0.72 },
  body: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  footnote: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
