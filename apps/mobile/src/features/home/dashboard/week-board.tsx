import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLog } from '@/api/hooks';
import type { ActivityLog, LocalDate, PlannedSession, PlanWeek } from '@/api/types';
import { Section } from '@/components/layout';
import { Badge, FocusRing, Icon, type IconName, PressableScale, Text } from '@/components/ui';
import { formatDayShort, formatLongDate, formatMinutes, formatTime, fromLocalDate } from '@/lib/dates';
import { type SessionDayState, sessionDayState, sessionMinutes, sessionStart, weekProgress } from '@/lib/sessions';
import { sportIcon } from '@/lib/sport-visuals';
import { routes } from '@/navigation/routes';
import { type SemanticColors, useTheme } from '@/theme';

import { feltText, stripDayLabel } from '../home-model';
import { Appear, type AppearFrom } from './appear';
import { type BoardDay, boardDays } from './board-model';
import { useMainColumnWidth } from './dashboard-layout';
import { HoverTint } from './hover';

/** A day column never gets narrower than this; below seven of them the board lists the days instead. */
const COLUMN_MIN = 84;
const GAP = 8;
const COLUMNS_MIN_WIDTH = COLUMN_MIN * 7 + GAP * 6;
/** The day's date circle. */
const DISC = 34;

type Layout = 'columns' | 'rows';

type WeekBoardProps = {
  /** "This week", "Next week", "Week of 28 Sep – 4 Oct". */
  title: string;
  /** The week's summary when the page header doesn't already show it (another week than this one). */
  summary?: string | null;
  week: PlanWeek;
  today: LocalDate;
  /** The day the hero shows. */
  selected: LocalDate;
  /** The plan's active version: sessions it changed get an Updated tag. */
  activeVersion: number | null;
  /** Shows a day in the hero; without it the days are display only (a quiet week). */
  onSelectDay?: (date: LocalDate) => void;
  /** The side the week was paged from, so it slides in from there. */
  from: AppearFrom;
};

/**
 * The week as a board: seven day columns with their sessions, or, where seven
 * columns don't fit, a row per day. A day's head shows it in the hero; a
 * session opens it. Today is outlined in the accent; done, not logged and
 * skipped sessions say so in words, never colour alone.
 */
export function WeekBoard({ title, summary, week, today, selected, activeVersion, onSelectDay, from }: WeekBoardProps) {
  const width = useMainColumnWidth();
  const days = boardDays(week, today);
  const { done, total } = weekProgress(week);
  const count = week.sessions.length;
  const aside = done ? `${done} of ${total} done` : `${count} ${count === 1 ? 'session' : 'sessions'}`;
  const layout: Layout = width >= COLUMNS_MIN_WIDTH ? 'columns' : 'rows';

  return (
    <View style={styles.board}>
      <View style={styles.intro}>
        <View style={styles.head}>
          <Section>{title}</Section>
          <Text variant="caption" tabular>
            {aside}
          </Text>
        </View>
        {summary ? <Text variant="bodySm">{summary}</Text> : null}
      </View>
      <View style={layout === 'columns' ? styles.columns : styles.rows}>
        {days.map((day, i) => (
          <Appear key={day.date} index={i} from={from} style={layout === 'columns' ? styles.columnCell : null}>
            <DayCard
              day={day}
              layout={layout}
              today={today}
              selected={day.date === selected}
              activeVersion={activeVersion}
              onSelect={onSelectDay}
            />
          </Appear>
        ))}
      </View>
    </View>
  );
}

type DayCardProps = {
  day: BoardDay;
  layout: Layout;
  today: LocalDate;
  selected: boolean;
  activeVersion: number | null;
  onSelect?: (date: LocalDate) => void;
};

function DayCard({ day, layout, today, selected, activeVersion, onSelect }: DayCardProps) {
  const { colors, radius } = useTheme();
  const isToday = day.date === today;
  const columns = layout === 'columns';
  const tile = columns ? 'stack' : 'inline';
  return (
    <View
      style={[
        columns ? styles.dayColumn : styles.dayRow,
        {
          borderRadius: radius.md,
          backgroundColor: colors.surfaceCard,
          borderColor: isToday ? colors.accent : selected && onSelect ? colors.borderStrong : colors.borderSubtle,
        },
        isToday && styles.todayBorder,
      ]}>
      <DayHead day={day} layout={layout} isToday={isToday} selected={selected} onSelect={onSelect} />
      <View style={columns ? styles.columnItems : styles.rowItems}>
        {day.rows.length ? (
          day.rows.map((row) =>
            row.kind === 'session' ? (
              <SessionTile
                key={row.session.id}
                session={row.session}
                date={row.date}
                today={today}
                activeVersion={activeVersion}
                layout={tile}
              />
            ) : (
              <ExtraTile key={row.log.id} log={row.log} date={row.date} layout={tile} />
            ),
          )
        ) : (
          <FreeDay state={day.state} layout={layout} onPress={onSelect ? () => onSelect(day.date) : undefined} />
        )}
      </View>
    </View>
  );
}

type DayHeadProps = {
  day: BoardDay;
  layout: Layout;
  isToday: boolean;
  selected: boolean;
  onSelect?: (date: LocalDate) => void;
};

/** The weekday over the date, drawn like the phone's week strip: today filled, done tinted with a check, not logged dashed. */
function DayHead({ day, layout, isToday, selected, onSelect }: DayHeadProps) {
  const { colors, fontFamily } = useTheme();
  const ring = !!onSelect && selected && !isToday;
  const dashed = day.state === 'unlogged' && !isToday;
  const disc = isToday
    ? { bg: colors.surfaceInverse, fg: colors.textInverse }
    : day.state === 'done'
      ? { bg: colors.successSoft, fg: colors.successText }
      : day.state === 'planned'
        ? { bg: 'transparent', fg: colors.accentText }
        : { bg: 'transparent', fg: colors.textSecondary };

  return (
    <PressableScale
      disabled={!onSelect}
      onPress={onSelect ? () => onSelect(day.date) : undefined}
      focusRing="none"
      accessibilityRole={onSelect ? 'button' : undefined}
      accessibilityLabel={stripDayLabel(day, isToday)}
      accessibilityHint={onSelect ? 'Shows this day above' : undefined}
      aria-selected={onSelect ? selected : undefined}
      style={layout === 'columns' ? styles.headColumn : styles.headRow}>
      {({ focusVisible, hovered }) => (
        <>
          <HoverTint visible={hovered} />
          <Text
            variant="caption"
            tone={isToday ? 'accent' : 'tertiary'}
            style={isToday ? { fontFamily: fontFamily.bodySemibold } : undefined}>
            {isToday ? 'Today' : formatDayShort(day.date)}
          </Text>
          <View
            collapsable={false}
            style={[
              styles.disc,
              { backgroundColor: disc.bg },
              dashed && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textTertiary },
            ]}>
            <Text variant="numeric" tabular style={{ fontSize: 16, lineHeight: 19, letterSpacing: 0, color: disc.fg }}>
              {fromLocalDate(day.date).getDate()}
            </Text>
            {ring ? <View style={[styles.ring, { borderColor: colors.textPrimary }]} /> : null}
            {day.state === 'done' && !isToday ? (
              <View style={[styles.check, { backgroundColor: colors.success, borderColor: colors.surfaceCard }]}>
                <Icon name="check" size={9} strokeWidth={3.25} color={colors.surfaceCard} />
              </View>
            ) : null}
            {focusVisible ? <FocusRing radius={DISC / 2} /> : null}
          </View>
        </>
      )}
    </PressableScale>
  );
}

/** A day without sessions: rest in a planned week, nothing planned otherwise. Shows the day in the hero. */
function FreeDay({ state, layout, onPress }: { state: BoardDay['state']; layout: Layout; onPress?: () => void }) {
  const { colors } = useTheme();
  const rest = state === 'rest';
  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      // A mouse shortcut to the day's head, which keyboards and screen readers use.
      accessible={false}
      focusable={false}
      style={[styles.free, layout === 'columns' ? styles.freeColumn : styles.freeRow]}>
      {({ hovered }) => (
        <>
          <HoverTint visible={hovered} />
          <Icon name={rest ? 'feather' : 'calendar'} size={16} color={colors.textTertiary} />
          <Text variant="caption" align="center">
            {rest ? 'Rest day' : 'Nothing planned'}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

type TileLayout = 'stack' | 'inline';

type TileLook = { bg: keyof SemanticColors | null; border: keyof SemanticColors | null; dashed?: boolean };

/** Done is moss, today blue, planned sunken; a session nobody logged is a dashed outline, skipped a plain one. */
const LOOKS: Record<SessionDayState | 'extra', TileLook> = {
  done: { bg: 'successSoft', border: null },
  today: { bg: 'accentSoft', border: null },
  planned: { bg: 'surfaceSunken', border: null },
  unlogged: { bg: null, border: 'textTertiary', dashed: true },
  skipped: { bg: null, border: 'borderSubtle' },
  extra: { bg: null, border: 'borderSubtle' },
};

const STATUS: Record<SessionDayState | 'extra', { icon: IconName; label: string; tone: 'success' | 'accent' | 'tertiary' } | null> = {
  done: { icon: 'check', label: 'Done', tone: 'success' },
  today: { icon: 'clock', label: 'Today', tone: 'accent' },
  planned: null,
  unlogged: { icon: 'circle-dashed', label: 'Not logged', tone: 'tertiary' },
  skipped: { icon: 'moon', label: 'Skipped', tone: 'tertiary' },
  extra: { icon: 'plus', label: 'Extra', tone: 'tertiary' },
};

type SessionTileProps = {
  session: PlannedSession;
  date: LocalDate;
  today: LocalDate;
  activeVersion: number | null;
  layout: TileLayout;
};

/** A plan session on the board (the week list's row, as a card): opens the session. */
function SessionTile({ session, date, today, activeVersion, layout }: SessionTileProps) {
  const router = useRouter();
  const state = sessionDayState(session, today);
  const log = useLog(state === 'done' ? session.log_id : null).data;
  const quiet = state !== 'planned' && state !== 'today';
  const updated = !quiet && activeVersion !== null && session.changed_in_version === activeVersion;
  const minutes = log ? Math.round(log.duration_seconds / 60) : sessionMinutes(session);
  const felt = log?.feedback?.felt;
  const length = [formatMinutes(minutes), felt ? feltText(felt) : null].filter(Boolean).join(' · ');
  const time = formatTime(sessionStart(session));

  const words = [
    updated ? 'updated' : null,
    session.optional ? 'optional' : null,
    { done: 'done', unlogged: 'not logged', skipped: 'skipped', today: 'today', planned: null }[state],
  ].filter(Boolean);

  return (
    <Tile
      look={LOOKS[state]}
      status={STATUS[state]}
      layout={layout}
      icon={sportIcon(session.sport_id)}
      time={time}
      title={session.title}
      quiet={quiet}
      meta={length}
      tags={
        updated || session.optional ? (
          <>
            {updated ? <Badge tone="accent">Updated</Badge> : null}
            {session.optional ? <Badge>Optional</Badge> : null}
          </>
        ) : null
      }
      accessibilityLabel={[formatLongDate(date), session.title, time, length, ...words].join(', ')}
      onPress={() => router.push(routes.session(session.id))}
    />
  );
}

/** A workout added outside the plan: history, never counted. Opens Log it to edit it. */
function ExtraTile({ log, date, layout }: { log: ActivityLog; date: LocalDate; layout: TileLayout }) {
  const router = useRouter();
  const felt = log.feedback?.felt;
  const length = [formatMinutes(log.duration_seconds / 60), felt ? feltText(felt) : null].filter(Boolean).join(' · ');
  const time = formatTime(log.started_at);
  return (
    <Tile
      look={LOOKS.extra}
      status={STATUS.extra}
      layout={layout}
      icon={sportIcon(log.sport_id)}
      time={time}
      title={log.title}
      quiet
      meta={length}
      accessibilityLabel={[formatLongDate(date), log.title, time, length, 'extra'].join(', ')}
      onPress={() => router.push(routes.log('new', log.id))}
    />
  );
}

type TileProps = {
  look: TileLook;
  status: (typeof STATUS)[keyof typeof STATUS];
  layout: TileLayout;
  icon: IconName;
  time: string;
  title: string;
  quiet: boolean;
  meta: string;
  tags?: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
};

function Tile({ look, status, layout, icon, time, title, quiet, meta, tags, accessibilityLabel, onPress }: TileProps) {
  const { colors, motion, radius } = useTheme();
  const stack = layout === 'stack';
  const statusRow = status ? (
    <View style={styles.status}>
      <Icon
        name={status.icon}
        size={13}
        strokeWidth={2.25}
        color={status.tone === 'success' ? colors.successText : status.tone === 'accent' ? colors.accentText : colors.textTertiary}
      />
      <Text variant="caption" tone={status.tone} numberOfLines={1}>
        {status.label}
      </Text>
    </View>
  ) : null;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={motion.pressScaleCard}
      lift={stack ? 2 : 0}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        stack ? styles.tileStack : styles.tileInline,
        {
          borderRadius: radius.sm,
          backgroundColor: look.bg ? colors[look.bg] : 'transparent',
          borderColor: look.border ? colors[look.border] : 'transparent',
          borderStyle: look.dashed ? 'dashed' : 'solid',
        },
      ]}>
      {({ hovered }) => (
        <>
          <HoverTint visible={hovered} />
          {stack ? (
            <>
              <View style={styles.tileTop}>
                <Text variant="caption" tone="secondary" tabular>
                  {time}
                </Text>
                <Icon name={icon} size={14} color={colors.textTertiary} />
              </View>
              <Text variant="bodyStrong" tone={quiet ? 'secondary' : 'primary'} numberOfLines={3} style={styles.stackTitle}>
                {title}
              </Text>
              <Text variant="caption" numberOfLines={2} tabular>
                {meta}
              </Text>
              {statusRow}
              {tags ? <View style={styles.tags}>{tags}</View> : null}
            </>
          ) : (
            <>
              <View style={[styles.inlineIcon, { backgroundColor: colors.surfaceCard }]}>
                <Icon name={icon} size={16} color={colors.textSecondary} />
              </View>
              <View style={styles.inlineMiddle}>
                <View style={styles.inlineTitle}>
                  <Text variant="bodyStrong" tone={quiet ? 'secondary' : 'primary'} style={{ flexShrink: 1 }}>
                    {title}
                  </Text>
                  {tags}
                </View>
                <Text variant="caption" tabular numberOfLines={1}>
                  {`${time} · ${meta}`}
                </Text>
              </View>
              {statusRow}
            </>
          )}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  board: { gap: 14 },
  intro: { gap: 6 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GAP,
  },
  rows: { gap: GAP },
  columnCell: { flex: 1, minWidth: 0 },
  dayColumn: {
    flex: 1,
    minHeight: 228,
    padding: 6,
    gap: 6,
    borderWidth: 1,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 72,
    padding: 6,
    gap: 10,
    borderWidth: 1,
  },
  todayBorder: { borderWidth: 1.5 },
  headColumn: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headRow: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnItems: { flex: 1, gap: 6 },
  rowItems: { flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' },
  free: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  freeColumn: { flex: 1, paddingVertical: 16 },
  freeRow: { flexDirection: 'row', justifyContent: 'flex-start', minHeight: 44, paddingHorizontal: 10 },
  tileStack: {
    gap: 4,
    padding: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  stackTitle: { fontSize: 14, lineHeight: 18 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tileInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  inlineIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineMiddle: { flex: 1, minWidth: 0, gap: 2 },
  inlineTitle: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
