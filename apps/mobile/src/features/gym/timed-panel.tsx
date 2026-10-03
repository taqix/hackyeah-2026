import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { Col } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { useTheme } from '@/theme';

import { CountdownRing } from './countdown-ring';
import { formatCountdown, formatSeconds } from './format';
import { firstOpen, type GymState, roundRemainingMs } from './model';

type RoundState = 'done' | 'current' | 'next';

/** One chip per round: done rounds show their real time, the current one says Now. */
function Rounds({ items }: { items: { state: RoundState; label: string }[] }) {
  const { colors, fontFamily } = useTheme();
  const look = {
    done: { backgroundColor: colors.surfaceSunken, borderColor: 'transparent', borderWidth: 1, color: colors.textSecondary },
    current: { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: 1.5, color: colors.accentText },
    next: { backgroundColor: 'transparent', borderColor: colors.borderStrong, borderWidth: 1, color: colors.textTertiary },
  };
  return (
    <View style={styles.rounds}>
      {items.map((round, i) => {
        const l = look[round.state];
        return (
          <View
            key={i}
            accessible
            accessibilityLabel={`Round ${i + 1}, ${round.state === 'done' ? `done, ${round.label}` : round.state === 'current' ? 'now' : round.label}`}
            style={[
              styles.round,
              { backgroundColor: l.backgroundColor, borderColor: l.borderColor, borderWidth: l.borderWidth },
            ]}>
            {round.state === 'done' ? <Icon name="check" size={14} strokeWidth={2.5} color={l.color} /> : null}
            <Text tabular style={{ color: l.color, fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 17 }}>
              {round.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** 6.5: a countdown per round; the ring empties as time runs. Effort colour. */
export function TimedPanel({ state }: { state: GymState }) {
  const { colors, fontFamily } = useTheme();
  const at = useNow(250).getTime();
  const step = state.steps[state.current];
  const sets = state.entries[state.current];
  const open = firstOpen(sets);
  const hold = step.holdSeconds * 1000;
  const left = open === -1 ? 0 : roundRemainingMs(state, at);
  const status = state.round.status;
  const sub =
    open === -1
      ? 'All rounds done'
      : status === 'running'
        ? `left of ${formatSeconds(step.holdSeconds)}`
        : status === 'paused'
          ? 'Paused'
          : `Start when you're ready`;
  const items = sets.map((s, i) => ({
    state: (s.done ? 'done' : i === open ? 'current' : 'next') as RoundState,
    label: s.done ? formatSeconds(s.seconds ?? step.holdSeconds) : i === open ? 'Now' : formatSeconds(step.holdSeconds),
  }));

  return (
    <>
      <View style={styles.ring}>
        <CountdownRing
          value={hold ? left / hold : 0}
          color={colors.accent}
          size={236}
          accessibilityLabel={`${formatCountdown(left)} left of ${formatSeconds(step.holdSeconds)}. ${sub}`}>
          <Col gap={8} style={{ alignItems: 'center' }}>
            <Text tabular style={{ fontFamily: fontFamily.displayBold, fontSize: 64, lineHeight: 68 }}>
              {formatCountdown(left)}
            </Text>
            <Text variant="bodySm">{sub}</Text>
          </Col>
        </CountdownRing>
      </View>
      {sets.length > 1 ? (
        <Col gap={10}>
          <Text variant="label" tone="secondary" align="center">
            {open === -1 ? `${sets.length} rounds done` : `Round ${open + 1} of ${sets.length}`}
          </Text>
          <Rounds items={items} />
        </Col>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', paddingVertical: 12 },
  rounds: { flexDirection: 'row', gap: 8 },
  round: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
