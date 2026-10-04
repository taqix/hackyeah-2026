import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { usePlanState, useSessionsInRange } from '@/api/hooks';
import { Icon, ListRow, PressableScale, Text, TextLink } from '@/components/ui';
import { formatDateShort, formatWeekRange, toLocalDate } from '@/lib/dates';
import { sportIcon } from '@/lib/sport-visuals';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { buildJourney, type JourneyWeek, journeyRange } from './journey';
import { whenText } from './labels';
import { PanelCard } from './panel';
import { ErrorState, RowsSkeleton } from './pieces';

const TITLE = 'Your weeks';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** You (desktop): the weeks since the first plan, what's done, and the latest session. */
export function JourneyCard({ today }: { today: Date }) {
  const router = useRouter();
  const plan = usePlanState();
  const first = plan.data?.first_week_start ?? null;
  const todayDate = toLocalDate(today);
  const range = first ? journeyRange(first, todayDate) : null;
  const history = useSessionsInRange(range?.from, range?.to);

  if (plan.isPending || (first && history.isPending)) {
    return (
      <PanelCard title={TITLE}>
        <RowsSkeleton count={3} disc={28} />
      </PanelCard>
    );
  }
  if (!first) {
    return (
      <PanelCard title={TITLE}>
        <Text variant="bodySm">Your weeks show up here once your first plan is ready.</Text>
      </PanelCard>
    );
  }
  if (history.isError || !history.data) {
    return (
      <PanelCard title={TITLE}>
        <ErrorState title="We couldn't load your weeks" onRetry={() => void history.refetch()} />
      </PanelCard>
    );
  }

  const journey = buildJourney(first, todayDate, history.data.sessions, history.data.extras);
  const weeks = [...journey.weeks].reverse();
  const weekCount = journey.weeks.at(-1)?.number ?? 1;
  const last = journey.last;

  return (
    <PanelCard
      title={TITLE}
      caption={`Since ${formatDateShort(journey.since)}`}
      gap={16}
      action={
        <TextLink onPress={() => router.navigate('/calendar')} accessibilityHint="Opens your calendar">
          Calendar
        </TextLink>
      }>
      <View style={styles.stats}>
        <Stat value={journey.done} label={plural(journey.done, 'session done', 'sessions done')} />
        <Stat value={weekCount} label={plural(weekCount, 'week with Movo', 'weeks with Movo')} />
        {journey.extras ? (
          <Stat value={journey.extras} label={plural(journey.extras, 'workout added', 'workouts added')} />
        ) : null}
      </View>
      <View>
        {weeks.map((week, i) => (
          <WeekRow
            key={week.weekStart}
            week={week}
            divider={i > 0}
            onPress={() => router.navigate(routes.today({ week: week.weekStart }))}
          />
        ))}
      </View>
      {last ? (
        <ListRow
          icon={sportIcon(last.sport_id)}
          discSize={36}
          label="Last done"
          title={last.title}
          detail={sentence(whenText(last.time_slot.start, today))}
          onPress={() => router.push(routes.session(last.id))}
          divider
        />
      ) : null}
    </PanelCard>
  );
}

/** A plain count with what it counts: no targets, scores or streaks. */
function Stat({ value, label }: { value: number; label: string }) {
  const { colors, radius, fontFamily } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[styles.stat, { backgroundColor: colors.surfaceSunken, borderRadius: radius.md }]}>
      <Text
        tabular
        style={{ fontFamily: fontFamily.displaySemibold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 }}>
        {String(value)}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

/** One week: its number and dates, a dot per session (done filled), and "2 of 3 done". Opens it on Today. */
function WeekRow({ week, divider, onPress }: { week: JourneyWeek; divider: boolean; onPress: () => void }) {
  const { colors, radius, motion } = useTheme();
  const progress = week.total ? `${week.done} of ${week.total} done` : 'No sessions';
  const ideas = week.ideas ? `, plus ${week.ideas} ${plural(week.ideas, 'new idea', 'new ideas')}` : '';
  const when = week.current ? 'This week' : formatWeekRange(week.weekStart);
  return (
    <View style={divider ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : null}>
      <PressableScale
        onPress={onPress}
        scaleTo={motion.pressScaleCard}
        focusRing="inset"
        accessibilityRole="button"
        accessibilityLabel={`Week ${week.number}, ${when}: ${progress}${ideas}`}
        accessibilityHint="Opens this week on Today"
        style={({ hovered }) => [
          styles.week,
          { borderRadius: radius.sm, backgroundColor: hovered ? colors.hoverWash : 'transparent' },
        ]}>
        <View style={styles.weekName}>
          <Text variant="bodyStrong">{`Week ${week.number}`}</Text>
          <Text variant="caption">{when}</Text>
        </View>
        <View style={styles.dots} aria-hidden>
          {Array.from({ length: week.total }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < week.done
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { borderColor: colors.borderStrong },
              ]}>
              {i < week.done ? <Icon name="check" size={8} strokeWidth={3} color={colors.textOnAccent} /> : null}
            </View>
          ))}
          {week.ideas ? (
            <Text variant="caption" tone="accent" tabular>
              {`+${week.ideas}`}
            </Text>
          ) : null}
        </View>
        <Text variant="bodySm" tabular style={styles.progress}>
          {progress}
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: 78, minWidth: 0, gap: 2, paddingVertical: 12, paddingHorizontal: 12 },
  week: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: -12,
  },
  weekName: { width: 94, gap: 2 },
  dots: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flexShrink: 0 },
});
