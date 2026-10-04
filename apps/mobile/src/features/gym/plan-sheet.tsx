import { ScrollView, StyleSheet, View } from 'react-native';

import { Badge, Icon, PressableScale, Sheet, Text } from '@/components/ui';
import { Col, Row, Section } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { formatMinutes } from '@/lib/dates';
import { useTheme } from '@/theme';

import { formatKg } from './format';
import { firstOpen, type GymState, type GymStep, isExerciseDone, plannedLabel, type SetEntry } from './model';
import { StepDisc, type StepState } from './step-disc';

const KIND_ICON = { reps: 'dumbbell', time: 'timer' } as const;

/** Where the current exercise is: 'Set 2 of 3 · 8 kg', 'Round 2 of 3'. */
function currentDetail(step: GymStep, sets: SetEntry[], lastWeight: number | null): string {
  const open = firstOpen(sets);
  if (open === -1) return plannedLabel(step);
  if (step.tracking === 'time') return sets.length > 1 ? `Round ${open + 1} of ${sets.length}` : plannedLabel(step);
  const entry = sets[open];
  const weight = entry.weight === undefined ? lastWeight : entry.weight;
  return `Set ${open + 1} of ${sets.length}${weight != null ? ` · ${formatKg(weight)} kg` : ''}`;
}

function PlanStep({ n, step, detail, state, onPress }: { n: number; step: GymStep; detail: string; state: StepState; onPress: () => void }) {
  const { colors, fontFamily, radius } = useTheme();
  const current = state === 'current';
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${step.name}, ${detail}, ${state === 'done' ? 'done' : current ? 'now' : 'to do'}`}
      accessibilityHint={current ? undefined : 'Does this exercise now'}
      aria-selected={current}
      style={({ pressed }) => [
        styles.step,
        {
          borderRadius: radius.md,
          backgroundColor: current ? colors.accentSoft : pressed ? colors.surfaceSunken : 'transparent',
        },
      ]}>
      <StepDisc n={n} state={state} />
      <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: fontFamily.bodySemibold,
            fontSize: 16,
            lineHeight: 21,
            color: state === 'done' ? colors.textSecondary : colors.textPrimary,
          }}>
          {step.name}
        </Text>
        <Row gap={6}>
          <Icon name={KIND_ICON[step.tracking]} size={14} color={colors.textSecondary} />
          <Text variant="bodySm" tabular style={{ flexShrink: 1 }}>
            {detail}
          </Text>
        </Row>
      </Col>
      {current ? (
        <Badge tone="accent">Now</Badge>
      ) : state === 'next' ? (
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      ) : null}
    </PressableScale>
  );
}

export function PlanMinutes({ startedAt, plannedMinutes }: { startedAt: number; plannedMinutes: number }) {
  const minutes = Math.floor((useNow(1000).getTime() - startedAt) / 60_000);
  return (
    <Text variant="label" tone="tertiary" tabular>
      {minutes} of {formatMinutes(plannedMinutes)}
    </Text>
  );
}

export type PlanSheetProps = {
  state: GymState;
  startedAt: number;
  plannedMinutes: number;
  lastWeight: number | null;
  onClose: () => void;
  onGoTo: (exercise: number) => void;
};

/** Every exercise with where it stands; a tap does that one now. `onCurrent` answers a tap on the current one. */
export function PlanSteps({
  state,
  lastWeight,
  onGoTo,
  onCurrent,
}: {
  state: GymState;
  lastWeight: number | null;
  onGoTo: (exercise: number) => void;
  onCurrent?: () => void;
}) {
  return (
    <>
      {state.steps.map((step, i) => {
        const sets = state.entries[i];
        const stepState: StepState = i === state.current ? 'current' : isExerciseDone(sets) ? 'done' : 'next';
        const detail = i === state.current ? currentDetail(step, sets, lastWeight) : plannedLabel(step);
        return (
          <PlanStep
            key={i}
            n={i + 1}
            step={step}
            detail={detail}
            state={stepState}
            onPress={() => (i === state.current ? onCurrent?.() : onGoTo(i))}
          />
        );
      })}
    </>
  );
}

/** The plan's footnote: exercises can be done in any order. */
export function PlanNote() {
  const { colors } = useTheme();
  return (
    <Row gap={8} style={styles.note}>
      <Icon name="info" size={16} color={colors.textTertiary} />
      <Text variant="caption" style={{ flex: 1 }}>
        Machine taken? Tap any exercise to do it now. The one you leave keeps its sets.
      </Text>
    </Row>
  );
}

/** 6.6: where you are, and what to do next if a machine is taken. */
export function PlanSheet({ state, startedAt, plannedMinutes, lastWeight, onClose, onGoTo }: PlanSheetProps) {
  return (
    <Sheet visible={state.sheet === 'plan'} onClose={onClose} label="Today's plan">
      <View style={styles.head}>
        <Section>Today&apos;s plan</Section>
        <PlanMinutes startedAt={startedAt} plannedMinutes={plannedMinutes} />
      </View>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 2 }}>
        <PlanSteps state={state} lastWeight={lastWeight} onGoTo={onGoTo} onCurrent={onClose} />
      </ScrollView>
      <PlanNote />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 12 },
  note: { paddingHorizontal: 4, alignItems: 'flex-start' },
});
