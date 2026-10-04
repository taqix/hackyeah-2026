import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLog } from '@/api/hooks';
import type { ActivityLog, LocalDate, PlannedSession, PlanWeek } from '@/api/types';
import { Section } from '@/components/layout';
import { Badge, Icon, PressableScale, Text } from '@/components/ui';
import { formatDateShort, formatDayShort, formatLongDate, formatMinutes } from '@/lib/dates';
import { sessionDayState, sessionMinutes, sessionTimeLabel, weekProgress } from '@/lib/sessions';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { feltText, weekRows } from './home-model';

type WeekListProps = {
  title: string;
  week: PlanWeek;
  today: LocalDate;
  /** The plan's active version: sessions it changed get an Updated tag. */
  activeVersion: number | null;
};

/** A week's sessions and extras. The aside counts what's done, or how many there are. */
export function WeekList({ title, week, today, activeVersion }: WeekListProps) {
  const rows = weekRows(week);
  const { done, total } = weekProgress(week);
  const count = week.sessions.length;
  const aside = done ? `${done} of ${total} done` : `${count} ${count === 1 ? 'session' : 'sessions'}`;
  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.head}>
        <Section>{title}</Section>
        <Text variant="caption" tabular>
          {aside}
        </Text>
      </View>
      {week.summary ? (
        <Text variant="bodySm" style={{ marginTop: 6 }}>
          {week.summary}
        </Text>
      ) : null}
      <View style={{ marginTop: 8 }}>
        {rows.map((row, i) =>
          row.kind === 'session' ? (
            <SessionRow
              key={row.session.id}
              session={row.session}
              date={row.date}
              today={today}
              activeVersion={activeVersion}
              divider={i > 0}
            />
          ) : (
            <ExtraRow key={row.log.id} log={row.log} date={row.date} divider={i > 0} />
          ),
        )}
      </View>
    </View>
  );
}

function SessionRow({
  session,
  date,
  today,
  activeVersion,
  divider,
}: {
  session: PlannedSession;
  date: LocalDate;
  today: LocalDate;
  activeVersion: number | null;
  divider: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const state = sessionDayState(session, today);
  const log = useLog(state === 'done' ? session.log_id : null).data;
  const quiet = state !== 'planned' && state !== 'today';
  const updated = !quiet && activeVersion !== null && session.changed_in_version === activeVersion;

  const minutes = log ? Math.round(log.duration_seconds / 60) : sessionMinutes(session);
  const felt = log?.feedback?.felt;
  const meta =
    state === 'done' ? [formatMinutes(minutes), felt ? feltText(felt) : null].filter(Boolean).join(' · ') : sessionTimeLabel(session);

  const end =
    state === 'done' ? (
      <Badge tone="success" dot>
        Done
      </Badge>
    ) : state === 'unlogged' ? (
      <Badge>Not logged</Badge>
    ) : state === 'skipped' ? (
      <Badge>Skipped</Badge>
    ) : state === 'today' ? (
      <Text variant="label" tone="accent">
        Today
      </Text>
    ) : (
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    );

  const words = [
    updated ? 'updated' : null,
    session.optional ? 'optional' : null,
    { done: 'done', unlogged: 'not logged', skipped: 'skipped', today: 'today', planned: null }[state],
  ].filter(Boolean);

  return (
    <Row
      date={date}
      title={session.title}
      quiet={quiet}
      meta={meta}
      tags={
        <>
          {updated ? <Badge tone="accent">Updated</Badge> : null}
          {session.optional ? <Badge>Optional</Badge> : null}
        </>
      }
      end={end}
      divider={divider}
      accessibilityLabel={[formatLongDate(date), session.title, meta, ...words].join(', ')}
      onPress={() => router.push(routes.session(session.id))}
    />
  );
}

/** A workout added outside the plan: history, never counted. Opens Log it to edit it. */
function ExtraRow({ log, date, divider }: { log: ActivityLog; date: LocalDate; divider: boolean }) {
  const router = useRouter();
  const felt = log.feedback?.felt;
  const meta = [formatMinutes(log.duration_seconds / 60), felt ? feltText(felt) : null].filter(Boolean).join(' · ');
  return (
    <Row
      date={date}
      title={log.title}
      quiet
      meta={meta}
      end={<Badge>Extra</Badge>}
      divider={divider}
      accessibilityLabel={[formatLongDate(date), log.title, meta, 'extra'].join(', ')}
      onPress={() => router.push(routes.log('new', log.id))}
    />
  );
}

function Row({
  date,
  title,
  quiet,
  meta,
  tags,
  end,
  divider,
  accessibilityLabel,
  onPress,
}: {
  date: LocalDate;
  title: string;
  quiet: boolean;
  meta: string;
  tags?: ReactNode;
  end: ReactNode;
  divider: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors, motion } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        divider && { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
      ]}>
      <View style={styles.when}>
        <Text variant="bodyStrong" style={{ lineHeight: 16 }}>
          {formatDayShort(date)}
        </Text>
        <Text variant="caption">{formatDateShort(date)}</Text>
      </View>
      <View style={styles.middle}>
        <View style={styles.titleLine}>
          <Text variant="bodyStrong" tone={quiet ? 'secondary' : 'primary'} style={{ flexShrink: 1 }}>
            {title}
          </Text>
          {tags}
        </View>
        <Text variant="caption" tabular>
          {meta}
        </Text>
      </View>
      {end}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: 10,
  },
  when: {
    width: 44,
    gap: 3,
  },
  middle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
});
