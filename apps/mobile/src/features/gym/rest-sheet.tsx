import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Sheet, Text } from '@/components/ui';
import { Col, Row } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { useTheme } from '@/theme';

import { CountdownRing } from './countdown-ring';
import { formatCountdown, formatKg, formatSeconds } from './format';
import { firstOpen, type GymState, plannedLabel, type Rest } from './model';

/** Extra rest per tap. */
export const REST_EXTEND_MS = 15_000;

function savedCopy(state: GymState, rest: Rest): { title: string; detail: string } {
  const step = state.steps[rest.exercise];
  const set = state.entries[rest.exercise][rest.set];
  if (step.tracking === 'time') {
    return {
      title: step.sets > 1 ? `Round ${rest.set + 1} saved` : `${step.name} saved`,
      detail: formatSeconds(set.seconds ?? step.holdSeconds),
    };
  }
  const kg = set.weight != null ? ` · ${formatKg(set.weight)} kg` : '';
  return { title: `Set ${rest.set + 1} saved`, detail: `${set.reps} reps${kg}` };
}

/** 'Next: set 3 · 10 reps · 8 kg', or the next exercise when this one is finished. */
function nextCopy(state: GymState, rest: Rest): { line: string; button: string } {
  const step = state.steps[state.current];
  const open = firstOpen(state.entries[state.current]);
  if (state.current !== rest.exercise || open === -1) {
    return { line: `Next: ${step.name} · ${plannedLabel(step)}`, button: 'Next exercise' };
  }
  if (step.tracking === 'time') {
    return { line: `Next: round ${open + 1} · ${formatSeconds(step.holdSeconds)}`, button: 'Next round' };
  }
  const set = state.entries[state.current][open];
  const kg = set.weight != null ? ` · ${formatKg(set.weight)} kg` : '';
  return { line: `Next: set ${open + 1} · ${set.reps} reps${kg}`, button: 'Next set' };
}

export type RestSheetProps = {
  state: GymState;
  onExtend: () => void;
  onSkip: () => void;
  onEdit: () => void;
};

/** 6.4: rest starts by itself after a set. Recovery colour, gentle default, skip or extend. */
export function RestSheet({ state, onExtend, onSkip, onEdit }: RestSheetProps) {
  const { rest } = state;
  // Keeps the last rest on screen while the sheet slides away.
  const [shown, setShown] = useState(rest);
  if (rest && rest !== shown) setShown(rest);
  return (
    <Sheet visible={!!rest && state.sheet === null} onClose={onSkip} label="Rest">
      {shown ? <RestBody state={state} rest={shown} onExtend={onExtend} onSkip={onSkip} onEdit={onEdit} /> : null}
    </Sheet>
  );
}

function RestBody({ state, rest, onExtend, onSkip, onEdit }: RestSheetProps & { rest: Rest }) {
  const { colors, fontFamily, radius } = useTheme();
  const at = useNow(250).getTime();
  const left = Math.max(0, rest.endsAt - at);
  const saved = savedCopy(state, rest);
  const next = nextCopy(state, rest);
  const canEdit = state.steps[rest.exercise].tracking === 'reps';
  return (
    <>
      <View style={[styles.saved, { backgroundColor: colors.surfaceSunken, borderRadius: radius.md }]}>
        <View style={[styles.check, { backgroundColor: colors.successSoft }]}>
          <Icon name="check" size={15} strokeWidth={2.5} color={colors.success} />
        </View>
        <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong">{saved.title}</Text>
          <Text variant="caption" tone="secondary" tabular>
            {saved.detail}
          </Text>
        </Col>
        {canEdit ? (
          <Button variant="ghost" size="sm" onPress={onEdit} accessibilityLabel={`Edit ${saved.title.replace(' saved', '').toLowerCase()}`}>
            Edit
          </Button>
        ) : null}
      </View>
      <View style={styles.ring}>
        <CountdownRing
          value={rest.totalMs ? left / rest.totalMs : 0}
          color={colors.recovery}
          size={200}
          accessibilityLabel={`Rest, ${formatCountdown(left)} left`}>
          <Col gap={6} style={{ alignItems: 'center' }}>
            <Text variant="label" tone="secondary">
              Rest
            </Text>
            <Text tabular style={{ fontFamily: fontFamily.displayBold, fontSize: 52, lineHeight: 56 }}>
              {formatCountdown(left)}
            </Text>
          </Col>
        </CountdownRing>
      </View>
      <Text variant="bodySm" align="center" tabular>
        {next.line}
      </Text>
      <Row gap={8}>
        <Button variant="secondary" size="lg" onPress={onExtend} accessibilityLabel="Rest 15 seconds longer">
          +15 s
        </Button>
        <Button size="lg" iconRight="arrow-right" onPress={onSkip} style={{ flex: 1 }}>
          {next.button}
        </Button>
      </Row>
    </>
  );
}

const styles = StyleSheet.create({
  saved: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 12, paddingRight: 8 },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center' },
});
