import { StyleSheet, View } from 'react-native';

import { Button, Icon, Sheet, Text } from '@/components/ui';
import { Body, Col } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { formatMinutes } from '@/lib/dates';
import { useTheme } from '@/theme';

import { doneSummary } from './format';
import { type GymState, loggedSets, setsFor } from './model';

export type EndSheetProps = {
  state: GymState;
  startedAt: number;
  saving: boolean;
  /** Shown when saving failed; the button tries again. */
  error: string | null;
  onSave: () => void;
  /** Nothing done yet: leave without saving; the session stays in the plan. */
  onLeave: () => void;
  onKeepGoing: () => void;
};

/** 6.7: what's done is saved and counts. No "missed" state. */
export function EndSheet({ state, startedAt, saving, error, onSave, onLeave, onKeepGoing }: EndSheetProps) {
  return (
    <Sheet visible={state.sheet === 'end'} onClose={saving ? () => {} : onKeepGoing} label="End session">
      <EndBody
        state={state}
        startedAt={startedAt}
        saving={saving}
        error={error}
        onSave={onSave}
        onLeave={onLeave}
        onKeepGoing={onKeepGoing}
      />
    </Sheet>
  );
}

function EndBody({ state, startedAt, saving, error, onSave, onLeave, onKeepGoing }: EndSheetProps) {
  const { colors, fontFamily, radius } = useTheme();
  const at = useNow(1000).getTime();
  const sets = loggedSets(state, at);
  const saved = state.steps
    .map((step) => ({ step, sets: setsFor(step, sets) }))
    .filter((row) => row.sets.length > 0);
  const minutes = Math.max(1, Math.round((at - startedAt) / 60_000));

  return (
    <>
      <Col gap={8} style={styles.pad}>
        <Text variant="heading" accessibilityRole="header">
          End here?
        </Text>
        <Body>
          {saved.length
            ? `You've moved for ${formatMinutes(minutes)}. Stopping early still counts — we'll save what you did.`
            : 'Nothing is logged yet, so the session stays in your plan for later.'}
        </Body>
      </Col>
      {saved.length ? (
        <View style={[styles.list, { backgroundColor: colors.surfaceSunken, borderRadius: radius.md }]}>
          {saved.map(({ step, sets: done }, i) => (
            <View
              key={step.name + i}
              style={[styles.row, i ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : null]}>
              <Icon name="check" size={16} strokeWidth={2.25} color={colors.success} />
              <Text style={{ flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 20 }}>{step.name}</Text>
              <Text variant="bodySm" tabular style={{ flexShrink: 1, textAlign: 'right' }}>
                {doneSummary(step, done)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {error ? (
        <View accessibilityRole="alert" style={[styles.error, styles.pad]}>
          <Icon name="circle-alert" size={16} color={colors.danger} />
          <Text variant="bodySm" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
      <Col gap={8}>
        {saved.length ? (
          <Button size="lg" fullWidth loading={saving} onPress={onSave}>
            {error ? 'Try again' : 'End and save'}
          </Button>
        ) : (
          <Button size="lg" fullWidth onPress={onLeave}>
            End session
          </Button>
        )}
        <Button size="lg" fullWidth variant="ghost" disabled={saving} onPress={onKeepGoing}>
          Keep going
        </Button>
      </Col>
    </>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 4 },
  list: { paddingVertical: 4, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8 },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
