import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import type { IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

import { activeNavFill } from '../nav-colors';
import { TAB_ITEMS } from '../tab-items';
import { AccountCard } from './account-card';
import { CoachButton } from './coach-button';
import { MovoMark } from './movo-mark';
import { NavItem } from './nav-item';
import { SHELL_INSET, SIDEBAR_ICON_CENTER, SIDEBAR_PADDING, SIDEBAR_ROW, SIDEBAR_WIDTH } from './shell-metrics';
import type { ShellDestination } from './shell-routes';
import { type ShellTarget, useShellNavigate } from './use-shell-navigate';

type NavEntry = { key: ShellDestination; label: string; icon: IconName; target: ShellTarget };

const TABS: readonly NavEntry[] = TAB_ITEMS.map((item) => ({
  key: item.route,
  label: item.label,
  icon: item.icon,
  target: { href: item.href, tab: true },
}));
const HISTORY: NavEntry = {
  key: 'plan-history',
  label: 'Plan history',
  icon: 'history',
  target: { href: '/plan-history', tab: false },
};
const SETTINGS: ShellTarget = { href: '/settings', tab: false };

const MARK = 32;
/** The hairline between the tabs and Plan history, and the air around it. */
const RULE_MARGIN = 8;
const STEP = SIDEBAR_ROW.height + SIDEBAR_ROW.gap;

/** Top of an item's row in the list, where the sliding pill goes; null for anything the list doesn't hold. */
function rowTop(key: ShellDestination | null): number | null {
  const index = TABS.findIndex((entry) => entry.key === key);
  if (index >= 0) return index * STEP;
  if (key === HISTORY.key) return TABS.length * STEP + RULE_MARGIN * 2 + 1 + SIDEBAR_ROW.gap;
  return null;
}

/** The current item's pill, sliding from item to item; it fades out where it stays (Settings). */
function Pill({ top }: { top: number | null }) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const [rest, setRest] = useState(top ?? 0);
  if (top !== null && top !== rest) setRest(top);
  return (
    <Animated.View
      aria-hidden
      style={[
        styles.pill,
        activeNavFill(colors),
        {
          opacity: top === null ? 0 : 1,
          transform: [{ translateY: top ?? rest }],
          transitionProperty: ['transform', 'opacity'],
          transitionDuration: reduced ? 1 : motion.durSlow,
          transitionTimingFunction: cubicBezier(...motion.easeOut),
        },
      ]}
    />
  );
}

export type SidebarProps = {
  /** Icons only, with labels as tooltips: medium windows, or beside the dock when the page would get too narrow. */
  railed: boolean;
  current: ShellDestination | null;
};

/**
 * The desktop web's navigation in place of the phone's floating tab bar: a
 * floating card with the mark, "Ask your coach", Today · Calendar · You and
 * Plan history, and the account with the way to Settings at its foot. It
 * narrows to an icon rail with a short width transition.
 */
export function Sidebar({ railed, current }: SidebarProps) {
  const { colors, shadows, motion } = useTheme();
  const reduced = useReducedMotion();
  const navigate = useShellNavigate();

  return (
    <Animated.View
      style={[
        styles.slot,
        {
          width: railed ? SIDEBAR_WIDTH.rail : SIDEBAR_WIDTH.wide,
          transitionProperty: 'width',
          transitionDuration: reduced ? 1 : motion.durSlow,
          transitionTimingFunction: cubicBezier(...motion.easeInOut),
        },
      ]}>
      <View
        role="navigation"
        aria-label="Main"
        style={[styles.card, shadows[1], { backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }]}>
        <View style={styles.brand}>
          <MovoMark size={MARK} />
          {railed ? null : (
            <Text variant="heading" numberOfLines={1}>
              Movo
            </Text>
          )}
        </View>
        <CoachButton railed={railed} />
        <View role="tablist" aria-label="Pages" style={styles.list}>
          <Pill top={rowTop(current)} />
          {TABS.map((entry) => (
            <NavItem
              key={entry.key}
              label={entry.label}
              icon={entry.icon}
              current={current === entry.key}
              railed={railed}
              onPress={() => navigate(entry.target)}
            />
          ))}
          <View style={[styles.rule, { backgroundColor: colors.borderSubtle }]} />
          <NavItem
            label={HISTORY.label}
            icon={HISTORY.icon}
            current={current === HISTORY.key}
            railed={railed}
            onPress={() => navigate(HISTORY.target)}
          />
        </View>
        <View style={styles.fill} />
        <AccountCard railed={railed} current={current === 'settings'} onPress={() => navigate(SETTINGS)} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    paddingTop: SHELL_INSET,
    paddingBottom: SHELL_INSET,
    paddingLeft: SHELL_INSET,
    // Over the page beside it: focus rings and the card's shadow aren't clipped by the main area.
    zIndex: 2,
  },
  card: {
    flex: 1,
    padding: SIDEBAR_PADDING,
    paddingTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    // Clips the labels while the card narrows; tooltips are drawn on the page, so nothing else is cut.
    overflow: 'hidden',
  },
  brand: {
    height: SIDEBAR_ROW.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: SIDEBAR_ICON_CENTER - MARK / 2,
    marginBottom: 14,
  },
  list: {
    marginTop: 20,
    gap: SIDEBAR_ROW.gap,
  },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SIDEBAR_ROW.height,
    borderRadius: 999,
    borderWidth: 1,
  },
  rule: {
    height: 1,
    marginVertical: RULE_MARGIN,
    marginHorizontal: 12,
  },
  fill: { flex: 1 },
});
