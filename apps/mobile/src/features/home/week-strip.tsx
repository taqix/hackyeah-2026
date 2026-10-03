import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import type { LocalDate } from '@/api/types';
import { Icon, Text } from '@/components/ui';
import { formatDayShort, fromLocalDate, weekDates } from '@/lib/dates';
import { useTheme } from '@/theme';

import { type StripDay, stripDayLabel } from './home-model';

const PULSE = { '50%': { opacity: 0.45 } };

type WeekStripProps = {
  days: StripDay[];
  today: LocalDate;
  selected: LocalDate;
  /** Tapping a day selects it; without it the strip is display only (5.11). */
  onSelect?: (date: LocalDate) => void;
};

/**
 * Seven days. Today is filled, done days are tinted with a check, planned days
 * have a dot, a past session nobody logged has a dashed ring, and another
 * selected day a ring. Never colour alone: every day has a full label.
 */
export function WeekStrip({ days, today, selected, onSelect }: WeekStripProps) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Week" style={styles.strip}>
      {days.map((day) => {
        const isToday = day.date === today;
        const isSelected = day.date === selected;
        const ring = !!onSelect && isSelected && !isToday;
        const dashed = day.state === 'unlogged' && !isToday;
        const disc = isToday
          ? { bg: colors.surfaceInverse, fg: colors.textInverse }
          : day.state === 'done'
            ? { bg: colors.successSoft, fg: colors.successText }
            : day.state === 'planned'
              ? { bg: 'transparent', fg: colors.accentText }
              : { bg: 'transparent', fg: colors.textTertiary };
        return (
          <Pressable
            key={day.date}
            disabled={!onSelect}
            onPress={onSelect ? () => onSelect(day.date) : undefined}
            accessibilityRole={onSelect ? 'button' : undefined}
            accessibilityLabel={stripDayLabel(day, isToday)}
            accessibilityState={onSelect ? { selected: isSelected } : undefined}
            style={styles.day}>
            <DayLetter date={day.date} isToday={isToday} />
            <View
              style={[
                styles.disc,
                { backgroundColor: disc.bg },
                dashed && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textTertiary },
              ]}>
              <DayNumber date={day.date} color={disc.fg} />
              {ring ? <View style={[styles.ring, { borderColor: colors.textPrimary }]} /> : null}
              {day.state === 'done' ? (
                <View style={[styles.check, { backgroundColor: colors.success, borderColor: colors.bgApp }]}>
                  <Icon name="check" size={10} strokeWidth={3.25} color={colors.surfaceCard} />
                </View>
              ) : null}
            </View>
            <View style={[styles.dot, { backgroundColor: day.state === 'planned' ? colors.accent : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** The strip while the week loads or the first plan builds: dates only, pulsing. */
export function WeekStripLoading({ weekStart, today }: { weekStart: LocalDate; today: LocalDate }) {
  const { colors } = useTheme();
  const dates = weekDates(weekStart);
  return (
    <View accessible accessibilityLabel="This week, loading" style={styles.strip}>
      {dates.map((date) => (
        <View key={date} style={styles.day}>
          <DayLetter date={date} isToday={date === today} />
          <Pulse>
            <View style={[styles.disc, { backgroundColor: colors.surfaceSunken }]}>
              <DayNumber date={date} color={colors.textTertiary} />
            </View>
          </Pulse>
          <View style={styles.dot} />
        </View>
      ))}
    </View>
  );
}

function DayLetter({ date, isToday }: { date: LocalDate; isToday: boolean }) {
  const { fontFamily } = useTheme();
  return (
    <Text
      variant="caption"
      tone={isToday ? 'primary' : 'tertiary'}
      style={isToday ? { fontFamily: fontFamily.bodySemibold } : undefined}>
      {formatDayShort(date).charAt(0)}
    </Text>
  );
}

function DayNumber({ date, color }: { date: LocalDate; color: string }) {
  return (
    <Text variant="numeric" tabular style={{ fontSize: 17, lineHeight: 20, letterSpacing: 0, color }}>
      {fromLocalDate(date).getDate()}
    </Text>
  );
}

function Pulse({ children }: { children: ReactNode }) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={{
        animationName: reduced ? 'none' : PULSE,
        animationDuration: 1600,
        animationIterationCount: 'infinite',
        animationTimingFunction: cubicBezier(...motion.easeInOut),
      }}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: 4,
  },
  day: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    borderWidth: 2,
  },
  check: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
