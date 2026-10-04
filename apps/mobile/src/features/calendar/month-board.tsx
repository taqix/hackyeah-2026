import { useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import type { LocalDate } from '@/api/types';
import { Icon, PressableScale, Text } from '@/components/ui';
import { addDays, formatMonthYear, WEEKDAYS_SHORT } from '@/lib/dates';
import { sportIcon } from '@/lib/sport-visuals';
import { type SemanticColors, type Theme, useTheme } from '@/theme';

import { dayAccessibilityLabel, type DayItem, itemTitle, markState, type MarkState } from './day-items';
import { dayCellId, dayKeyTarget } from './day-keys';
import { dayOfMonth, isInMonth, monthWeeks } from './month';
import { useArrowKeys } from './use-arrow-keys';

/** Roomy tiles name each session; compact ones (a narrow page) show its sport only. */
export type BoardDensity = 'roomy' | 'compact';

const GAP = 6;
const TILE: Record<BoardDensity, { height: number; padding: number; number: number }> = {
  roomy: { height: 120, padding: 8, number: 26 },
  compact: { height: 78, padding: 6, number: 24 },
};
/** Chips a tile shows before "+1 more"; the day's label still names every session. */
const MAX_CHIPS = 2;

/** Decorative: each day's label already says it in words. */
const hidden = { 'aria-hidden': true } as const;

const slideIn = (from: number) => ({
  from: { opacity: 0, transform: [{ translateX: from }] },
  to: { opacity: 1, transform: [{ translateX: 0 }] },
});
const FROM_RIGHT = slideIn(16);
const FROM_LEFT = slideIn(-16);
const FADE_IN = { from: { opacity: 0 }, to: { opacity: 1 } };

type MonthBoardProps = {
  month: LocalDate;
  /** Sessions and extras by day; undefined while they load. */
  days: Map<LocalDate, DayItem[]> | undefined;
  today: LocalDate;
  plannedThrough: LocalDate;
  selected: LocalDate;
  onSelect: (date: LocalDate) => void;
  /** A key moved the selection to this day: pick it if it can be picked, and say whether it was. */
  onKeyPick: (date: LocalDate) => boolean;
  /** 1 when this month follows the one shown before, -1 when it precedes it: it slides in from that side. */
  direction: 1 | -1;
  density: BoardDensity;
};

/**
 * The desktop month: Monday-first columns of day tiles, each with its
 * sessions as chips (the sport's icon, coloured by done, planned or missed).
 * Tiles hover and press; the arrow keys move between days. A new month slides
 * in from the side it came from.
 */
export function MonthBoard({
  month,
  days,
  today,
  plannedThrough,
  selected,
  onSelect,
  onKeyPick,
  direction,
  density,
}: MonthBoardProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const ref = useRef<View>(null);
  useArrowKeys(ref, selected, { target: dayKeyTarget, pick: onKeyPick, idOf: dayCellId });
  const firstUnplanned = addDays(plannedThrough, 1);
  const inset = TILE[density].padding + 1;

  return (
    <View ref={ref}>
      <View style={[styles.week, styles.weekdays]} {...hidden}>
        {WEEKDAYS_SHORT.map((weekday) => (
          <Text key={weekday} variant="caption" style={[styles.cell, { paddingLeft: inset }]}>
            {weekday}
          </Text>
        ))}
      </View>
      <Animated.View
        key={month}
        role="group"
        aria-label={formatMonthYear(month)}
        style={[
          styles.weeks,
          reduced
            ? null
            : {
                animationName: direction > 0 ? FROM_RIGHT : FROM_LEFT,
                animationDuration: motion.durSlow,
                animationTimingFunction: cubicBezier(...motion.easeOut),
              },
        ]}>
        {monthWeeks(month).map((week) => (
          <View key={week[0]} style={styles.week}>
            {week.map((date) =>
              isInMonth(date, month) ? (
                <DayTile
                  key={date}
                  date={date}
                  items={days ? (days.get(date) ?? []) : undefined}
                  today={today}
                  plannedThrough={plannedThrough}
                  selected={date === selected}
                  firstUnplanned={date === firstUnplanned}
                  density={density}
                  onSelect={onSelect}
                />
              ) : (
                <OutsideTile key={date} date={date} density={density} />
              ),
            )}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/** Another month's day at the edge of the grid: muted, not a button. */
function OutsideTile({ date, density }: { date: LocalDate; density: BoardDensity }) {
  const size = TILE[density];
  return (
    <View style={[styles.cell, styles.outside, { height: size.height, padding: size.padding + 1 }]} {...hidden}>
      <View style={[styles.number, { width: size.number, height: size.number }]}>
        <Text variant="numeric" tone="tertiary" tabular style={styles.numberText}>
          {dayOfMonth(date)}
        </Text>
      </View>
    </View>
  );
}

type DayTileProps = {
  date: LocalDate;
  items: DayItem[] | undefined;
  today: LocalDate;
  plannedThrough: LocalDate;
  selected: boolean;
  /** The first day past the plan, which says so. */
  firstUnplanned: boolean;
  density: BoardDensity;
  onSelect: (date: LocalDate) => void;
};

function DayTile({ date, items, today, plannedThrough, selected, firstUnplanned, density, onSelect }: DayTileProps) {
  const theme = useTheme();
  const { colors, motion } = theme;
  const reduced = useReducedMotion();
  const isToday = date === today;
  // Plans go one week ahead: nothing to show, or pick, past the last planned day.
  const ahead = date > plannedThrough && !isToday;
  const size = TILE[density];
  const list = items ?? [];
  const shown = list.slice(0, MAX_CHIPS);
  const more = list.length - shown.length;

  return (
    <PressableScale
      id={dayCellId(date)}
      onPress={() => onSelect(date)}
      disabled={ahead}
      // One tab stop for the month (the selected day); the arrow keys move from there.
      tabIndex={selected ? 0 : -1}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={dayAccessibilityLabel(date, items, { today, plannedThrough })}
      aria-selected={selected}
      aria-disabled={ahead}
      style={({ pressed, hovered }) => [
        styles.cell,
        styles.tile,
        {
          height: size.height,
          // The selected border is 2 wide: the padding gives the extra point back so nothing moves.
          padding: selected ? size.padding : size.padding + 1,
          borderWidth: selected ? 2 : 1,
          borderRadius: theme.radius.sm,
        },
        tileLook(theme, { pressed, hovered, selected, ahead }),
      ]}>
      <View
        collapsable={false}
        style={[
          styles.number,
          { width: size.number, height: size.number },
          isToday && { backgroundColor: colors.surfaceInverse },
        ]}>
        <Text
          variant="numeric"
          tone={isToday ? 'inverse' : ahead ? 'tertiary' : 'primary'}
          tabular
          style={[styles.numberText, ahead && styles.ahead]}>
          {dayOfMonth(date)}
        </Text>
      </View>
      {shown.length ? (
        <Animated.View
          style={[
            density === 'roomy' ? styles.chips : styles.icons,
            reduced ? null : { animationName: FADE_IN, animationDuration: motion.durBase },
          ]}
          {...hidden}>
          {shown.map((item) =>
            density === 'roomy' ? (
              <Chip key={item.key} item={item} state={markState(item, today)} />
            ) : (
              <SportDot key={item.key} item={item} state={markState(item, today)} />
            ),
          )}
          {more > 0 ? (
            <Text variant="caption" tone="secondary" tabular style={styles.more}>
              {density === 'roomy' ? `+${more} more` : `+${more}`}
            </Text>
          ) : null}
        </Animated.View>
      ) : firstUnplanned && density === 'roomy' ? (
        <Text variant="caption" style={styles.unplanned} {...hidden}>
          Not planned yet
        </Text>
      ) : null}
    </PressableScale>
  );
}

function tileLook(
  { colors, shadows }: Theme,
  { pressed, hovered, selected, ahead }: { pressed: boolean; hovered: boolean; selected: boolean; ahead: boolean },
): ViewStyle {
  if (ahead) return { backgroundColor: 'transparent', borderColor: colors.borderSubtle };
  const lifted = hovered && !pressed;
  return {
    backgroundColor: pressed ? colors.surfaceSunken : lifted ? colors.surfaceRaised : colors.surfaceCard,
    borderColor: selected ? colors.textPrimary : lifted ? colors.borderStrong : colors.borderSubtle,
    ...(lifted ? shadows[2] : shadows[1]),
  };
}

/** Done is green, planned is the accent, skipped or not logged is a dashed outline: the legend's marks. */
function chipLook(state: MarkState, colors: SemanticColors): { box: ViewStyle; ink: string } {
  switch (state) {
    case 'done':
      return { box: { backgroundColor: colors.successSoft }, ink: colors.successText };
    case 'planned':
      return { box: { backgroundColor: colors.accentSoftStrong }, ink: colors.accentText };
    default:
      return {
        box: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textTertiary },
        ink: colors.textSecondary,
      };
  }
}

function sportOf(item: DayItem): string {
  return item.kind === 'extra' ? item.log.sport_id : item.session.sport_id;
}

/** A session on a roomy tile: its sport and title. */
function Chip({ item, state }: { item: DayItem; state: MarkState }) {
  const { colors } = useTheme();
  const look = chipLook(state, colors);
  return (
    <View style={[styles.chip, look.box]}>
      <Icon name={sportIcon(sportOf(item))} size={12} color={look.ink} strokeWidth={2.25} />
      <Text variant="caption" numberOfLines={1} style={[styles.chipText, { color: look.ink }]}>
        {itemTitle(item)}
      </Text>
    </View>
  );
}

/** A session on a compact tile: its sport alone. */
function SportDot({ item, state }: { item: DayItem; state: MarkState }) {
  const { colors } = useTheme();
  const look = chipLook(state, colors);
  return (
    <View style={[styles.dot, look.box]}>
      <Icon name={sportIcon(sportOf(item))} size={12} color={look.ink} strokeWidth={2.25} />
    </View>
  );
}

const styles = StyleSheet.create({
  weekdays: { marginBottom: 8 },
  weeks: { gap: GAP },
  week: { flexDirection: 'row', gap: GAP },
  cell: { flex: 1, minWidth: 0 },
  tile: { gap: 6, overflow: 'hidden' },
  outside: { opacity: 0.45 },
  number: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginLeft: -2, marginTop: -2 },
  numberText: { fontSize: 14, lineHeight: 18 },
  ahead: { opacity: 0.55 },
  chips: { gap: 4 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  chipText: { flexShrink: 1, fontSize: 12, lineHeight: 16 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  more: { paddingLeft: 2 },
  unplanned: { marginTop: 'auto' },
});
