import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useUpdateLog } from '@/api/hooks';
import type { ActivityLog, LoggedSet } from '@/api/types';
import { Button, Icon, Sheet, Text } from '@/components/ui';
import { Col } from '@/components/layout';
import { useTheme } from '@/theme';

import type { GymStep } from './model';
import { NumberStepper } from './number-stepper';

export type FixTarget = { step: GymStep; sets: LoggedSet[] };

const RING_ROOM = 5;

export type FixSetsSheetProps = {
  log: ActivityLog;
  /** The exercise whose sets are open, or null when closed. */
  target: FixTarget | null;
  onClose: () => void;
};

/** 6.8 "Tap a line to fix it": the exercise's sets with steppers, saved onto the log. */
export function FixSetsSheet({ log, target, onClose }: FixSetsSheetProps) {
  // Keeps the last exercise on screen while the sheet slides away.
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);
  return (
    <Sheet visible={!!target} onClose={onClose} title={shown?.step.name} showClose>
      {shown ? <FixBody key={shown.step.name} log={log} target={shown} onClose={onClose} /> : null}
    </Sheet>
  );
}

function FixBody({ log, target, onClose }: { log: ActivityLog; target: FixTarget; onClose: () => void }) {
  const { colors } = useTheme();
  const updateLog = useUpdateLog();
  const [draft, setDraft] = useState(target.sets);
  const { step } = target;
  const time = step.tracking === 'time';
  const weighted = step.usesWeight || draft.some((s) => s.weight_kg != null);
  const change = (i: number, patch: Partial<LoggedSet>) =>
    setDraft((sets) => sets.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const save = () => {
    const sets = log.sets.map((s) => draft.find((d) => d.exercise_name === s.exercise_name && d.set_index === s.set_index) ?? s);
    updateLog.mutate({ id: log.id, patch: { sets } }, { onSuccess: onClose });
  };

  return (
    <>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {draft.map((set, i) => (
          <Col key={set.set_index} gap={8}>
            <Text variant="label" tone="secondary">
              {time ? (draft.length > 1 ? `Round ${i + 1}` : 'Time') : `Set ${i + 1}`}
            </Text>
            <View style={styles.row}>
              {time ? (
                <NumberStepper
                  label="Seconds"
                  value={set.seconds ?? 0}
                  unit="s"
                  step={step.holdSeconds >= 60 ? 15 : 5}
                  min={1}
                  onChange={(v) => change(i, { seconds: v ?? 1 })}
                />
              ) : (
                <>
                  {weighted ? (
                    <NumberStepper
                      label="Weight"
                      value={set.weight_kg}
                      unit="kg"
                      step={step.weightStep}
                      decimal
                      allowEmpty
                      onChange={(v) => change(i, { weight_kg: v })}
                    />
                  ) : null}
                  <NumberStepper label="Reps" value={set.reps ?? 0} unit="reps" onChange={(v) => change(i, { reps: v ?? 0 })} />
                </>
              )}
            </View>
          </Col>
        ))}
      </ScrollView>
      {updateLog.isError ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Icon name="circle-alert" size={16} color={colors.danger} />
          <Text variant="bodySm" tone="danger" style={{ flex: 1 }}>
            We couldn&apos;t save the change. Check your connection and try again.
          </Text>
        </View>
      ) : null}
      <Button size="lg" fullWidth loading={updateLog.isPending} onPress={save}>
        {updateLog.isError ? 'Try again' : 'Save'}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  // Room for a focused stepper's ring, which the scroll view would clip (and scroll to).
  list: { flexGrow: 0, flexShrink: 1, margin: -RING_ROOM },
  listContent: { gap: 16, padding: RING_ROOM },
  row: { flexDirection: 'row', gap: 8 },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
});
