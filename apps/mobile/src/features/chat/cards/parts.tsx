/** Building blocks shared by the chat cards (design/prototype/chat.jsx: Surface, Head, Fine, Diff). */
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native';

import type { IsoDateTime } from '@/api/types';
import { Disc, type DiscTone, Icon, type IconName, Text } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { useTheme } from '@/theme';

import { diffSpeech, type DiffView, stampLabel } from './format';

/** The card around a change, a logged workout, the updating state or a problem. */
export function Surface({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  const { colors, radius, shadows } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          alignSelf: 'stretch',
          backgroundColor: colors.surfaceCard,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          borderRadius: radius.card,
          ...shadows[1],
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** A band inside a Surface; every band after the first sits under a hairline. */
export function Band({
  children,
  divider = true,
  gap = 8,
  style,
  ...rest
}: ViewProps & { children: ReactNode; divider?: boolean; gap?: number }) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        { paddingVertical: 12, paddingHorizontal: 18, gap },
        divider ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : null,
        style,
      ]}>
      {children}
    </View>
  );
}

/** "Just now" for the first minute, then the clock time. */
export function Stamp({ at }: { at: IsoDateTime }) {
  const current = useNow(30_000);
  return (
    <Text variant="caption" tabular numberOfLines={1}>
      {stampLabel(at, current)}
    </Text>
  );
}

/** Disc, title and time: the top line of every card. */
export function Head({
  icon,
  tone,
  title,
  at,
  spin = false,
  trailing,
}: {
  icon: IconName;
  tone: DiscTone;
  title: string;
  at?: IsoDateTime;
  spin?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Disc icon={icon} tone={tone} size={32} spin={spin} />
      <Text variant="subheading" accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
        {title}
      </Text>
      {at ? <Stamp at={at} /> : null}
      {trailing}
    </View>
  );
}

/** Small status line under a message or a card: "Plan unchanged", the lock line. */
export function Fine({
  icon,
  tone = 'secondary',
  align = 'start',
  children,
  style,
}: {
  icon?: IconName;
  tone?: 'secondary' | 'danger';
  align?: 'start' | 'end';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const color = tone === 'danger' ? colors.dangerText : colors.textSecondary;
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: align === 'end' ? 'flex-end' : 'flex-start' },
        style,
      ]}>
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Text variant="caption" style={{ color, flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** Body copy inside a card, with an optional bold part. */
export function Small({ children }: { children: ReactNode }) {
  return <Text variant="bodySm">{children}</Text>;
}

/** The bold part of a sentence: "Your plan hasn't changed." */
export function Strong({ children }: { children: ReactNode }) {
  const { fontFamily } = useTheme();
  return (
    <Text variant="bodySm" tone="primary" style={{ fontFamily: fontFamily.bodySemibold }}>
      {children}
    </Text>
  );
}

/** One attribute: icon, old value struck through, arrow, new value. No `from` = a new value. */
export function Diff({ view, size = 15 }: { view: DiffView; size?: number }) {
  const { colors, fontFamily } = useTheme();
  const text = { fontSize: size, lineHeight: Math.round(size * 1.35) };
  return (
    <View
      accessible
      accessibilityLabel={diffSpeech(view)}
      style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      {view.icon ? <Icon name={view.icon} size={16} color={colors.accentText} /> : null}
      {view.from ? (
        <>
          <Text tabular tone="tertiary" style={[text, { textDecorationLine: 'line-through' }]}>
            {view.from}
          </Text>
          <Icon name="arrow-right" size={14} color={colors.textTertiary} />
        </>
      ) : null}
      <Text tabular style={[text, { fontFamily: fontFamily.bodySemibold }]}>
        {view.to}
      </Text>
    </View>
  );
}

/**
 * Says a card out loud when it appears. On the web the card's role (alert,
 * aria-live) does it; native screen readers don't announce a view on mount.
 */
export function useAnnounce(message: string) {
  useEffect(() => {
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}
