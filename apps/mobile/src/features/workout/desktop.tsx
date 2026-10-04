/**
 * Desktop web pieces shared by the session, logging, feedback and gym pages:
 * the two-column split measured on the page itself, the back row, a sticky
 * side column, hoverable side actions and the entering motion. Phones never
 * render these; every caller gates them with `useLayout().isDesktop`.
 */
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { css, useReducedMotion } from 'react-native-reanimated';

import { DESKTOP_GUTTER, useLayout } from '@/components/layout';
import { Button, Disc, Icon, type IconName, PressableScale, Text, webStyle } from '@/components/ui';
import { useTheme } from '@/theme';

/** The narrowest content that still takes a main column beside a side column. */
const SPLIT_MIN_WIDTH = 760;
/** Sidebar widths of the desktop shell, for the first guess before the page is measured. */
const SIDEBAR_WIDE = 248;
const SIDEBAR_RAIL = 84;

export type Split = {
  /** Main and side columns next to each other; stacked when false. */
  split: boolean;
  /** Width of the side column when split. */
  sideWidth: number;
  /** Pass to the page's Content: the page shares the window with the sidebar and maybe the docked coach. */
  onLayout: (event: LayoutChangeEvent) => void;
};

/**
 * Whether the page's own area fits two columns. It measures the scroll area
 * instead of reading the window, so a docked coach panel narrows the page.
 */
export function useSplit(maxWidth: number): Split {
  const { width, isWide } = useLayout();
  const [pane, setPane] = useState<number | null>(null);
  const guess = width - (isWide ? SIDEBAR_WIDE : SIDEBAR_RAIL);
  const content = Math.min(maxWidth, (pane ?? guess) - DESKTOP_GUTTER * 2);
  return {
    split: content >= SPLIT_MIN_WIDTH,
    sideWidth: content >= 1000 ? 360 : 320,
    onLayout: (event) => setPane(event.nativeEvent.layout.width),
  };
}

/** Sticks to the top of the page's scroll while the main column scrolls past (web only). */
const stickyStyle = webStyle({ position: 'sticky', top: 24 });

/** Main column and a sticky side column of a fixed width; the side stretches so it can stick. */
export function SplitColumns({ main, side, sideWidth, gap = 32 }: { main: ReactNode; side: ReactNode; sideWidth: number; gap?: number }) {
  return (
    <View style={[styles.split, { gap }]}>
      <View style={styles.main}>{main}</View>
      <View style={{ width: sideWidth }}>
        <View style={stickyStyle}>{side}</View>
      </View>
    </View>
  );
}

/** The back affordance of a nested desktop page, aligned with its content; `right` holds page actions. */
export function BackRow({ right, onBack }: { right?: ReactNode; onBack?: () => void }) {
  const router = useRouter();
  const back =
    onBack ??
    (() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    });
  return (
    <View style={styles.backRow}>
      <Button variant="ghost" size="sm" icon="arrow-left" onPress={back} style={styles.backButton}>
        Back
      </Button>
      {right}
    </View>
  );
}

// Only the start differs from the resting style, so an animation that never runs still leaves the content shown.
const fadeUp = css.keyframes({ from: { opacity: 0, transform: [{ translateY: 14 }] } });

/** Fades content up as it appears; `index` staggers siblings. Still under reduced motion. */
export function Reveal({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  if (reduced) return <View style={style}>{children}</View>;
  return (
    <Animated.View
      style={[
        style,
        {
          animationName: fadeUp,
          animationDuration: 280,
          animationDelay: index * 70,
          animationTimingFunction: 'ease-out',
          animationFillMode: 'backwards',
        },
      ]}>
      {children}
    </Animated.View>
  );
}

export type SideActionProps = {
  icon: IconName;
  title: string;
  detail?: string;
  onPress: () => void;
  accessibilityHint?: string;
};

/** A quiet action row in a side card: the surface sinks on hover and the disc picks up the accent. */
export function SideAction({ icon, title, detail, onPress, accessibilityHint }: SideActionProps) {
  const { colors, radius, motion } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      accessibilityHint={accessibilityHint}
      style={({ pressed, hovered }) => [
        styles.action,
        { borderRadius: radius.md, backgroundColor: pressed || hovered ? colors.surfaceSunken : 'transparent' },
      ]}>
      {({ hovered }) => (
        <>
          <Disc icon={icon} tone={hovered ? 'accent' : 'quiet'} size={40} />
          <View style={styles.actionText}>
            <Text variant="bodyStrong">{title}</Text>
            {detail ? <Text variant="bodySm">{detail}</Text> : null}
          </View>
          <Icon name="chevron-right" size={18} color={hovered ? colors.textSecondary : colors.textTertiary} />
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'stretch' },
  main: { flex: 1, minWidth: 0 },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  // The arrow lines up with the content edge, not the button's padding.
  backButton: { marginLeft: -14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10, paddingHorizontal: 10 },
  actionText: { flex: 1, minWidth: 0, gap: 2 },
});
