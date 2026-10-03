import { StyleSheet, View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { formatKg } from './format';
import type { GymStep, SetEntry } from './model';
import { NumberStepper } from './number-stepper';
import { StepDisc } from './step-disc';

type Shown = { reps: number; weight: number | null };

/** The weight a set shows: its own, or last time's while it has none. */
export function shownWeight(entry: SetEntry, lastWeight: number | null): number | null {
  return entry.weight === undefined ? lastWeight : entry.weight;
}

/** Done and upcoming sets. Tapping a row opens it like the current set, to fix a number. */
function SetLine({ n, set, done, usesWeight, onPress }: { n: number; set: Shown; done: boolean; usesWeight: boolean; onPress: () => void }) {
  const { colors, fontFamily, radius } = useTheme();
  const tone = done ? colors.textSecondary : colors.textTertiary;
  const num = { fontFamily: fontFamily.displaySemibold, fontSize: 15, lineHeight: 18, color: tone, textAlign: 'right' as const };
  const kg = usesWeight && set.weight != null ? set.weight : null;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`Set ${n}, ${done ? 'done' : 'planned'}, ${set.reps} reps${kg != null ? ` at ${formatKg(kg)} kg` : ''}`}
      accessibilityHint="Opens the set to change a number"
      style={({ pressed }) => [
        styles.line,
        { borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceSunken : 'transparent' },
      ]}>
      <StepDisc n={n} state={done ? 'done' : 'next'} />
      <Text
        style={{
          flex: 1,
          fontFamily: fontFamily.bodyMedium,
          fontSize: 16,
          lineHeight: 20,
          color: done ? colors.textPrimary : colors.textSecondary,
        }}>
        Set {n}
      </Text>
      {kg != null ? (
        <Text tabular style={[num, { width: 56 }]}>
          {formatKg(kg)} kg
        </Text>
      ) : null}
      <Text tabular style={[num, { width: 64 }]}>
        {set.reps} reps
      </Text>
    </PressableScale>
  );
}

type OpenSetProps = {
  n: number;
  step: GymStep;
  set: Shown;
  /** 'Now' for the set being done; 'Saved' or 'Later' for one opened to fix. */
  status: string;
  last: string | null;
  onReps: (value: number) => void;
  onWeight: (value: number | null) => void;
};

/**
 * The open set: reps from the plan, weight from last time (or the set before),
 * so one tap on the bottom button logs it. With no history the weight is empty.
 */
function OpenSet({ n, step, set, status, last, onReps, onWeight }: OpenSetProps) {
  const { colors, fontFamily, radius } = useTheme();
  return (
    <View style={[styles.open, { backgroundColor: colors.accentSoft, borderRadius: radius.md }]}>
      <View style={styles.openHead}>
        <StepDisc n={n} state="current" />
        <Text style={{ flex: 1, fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 20 }}>Set {n}</Text>
        <Text variant="caption" tone="accent">
          {status}
        </Text>
      </View>
      <View style={styles.steppers}>
        {step.usesWeight ? (
          <NumberStepper
            label="Weight"
            value={set.weight}
            unit="kg"
            step={step.weightStep}
            decimal
            allowEmpty
            onChange={onWeight}
          />
        ) : null}
        <NumberStepper label="Reps" value={set.reps} unit="reps" onChange={(v) => onReps(v ?? 0)} />
      </View>
      {last ? (
        <View style={styles.last}>
          <Icon name="history" size={14} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary" tabular style={{ flex: 1 }}>
            {last}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export type SetListProps = {
  step: GymStep;
  sets: SetEntry[];
  /** The set being done (first not done), or -1 when all are done. */
  current: number;
  /** A set opened to fix a number, or null. */
  editing: number | null;
  lastWeight: number | null;
  /** 'Last time, Mon 12 Oct: 3 × 10 · 8 kg' under the steppers of the set being done. */
  last: string | null;
  onOpen: (set: number) => void;
  onReps: (set: number, value: number) => void;
  onWeight: (set: number, value: number | null) => void;
  onAddSet: () => void;
};

export function SetList({ step, sets, current, editing, lastWeight, last, onOpen, onReps, onWeight, onAddSet }: SetListProps) {
  const { colors, radius, shadows } = useTheme();
  const open = editing ?? current;
  return (
    <View
      style={[
        styles.card,
        shadows[1],
        { backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle, borderRadius: radius.card },
      ]}>
      {sets.map((entry, i) => {
        const shown = { reps: entry.reps, weight: shownWeight(entry, lastWeight) };
        if (i === open) {
          return (
            <OpenSet
              key={i}
              n={i + 1}
              step={step}
              set={shown}
              status={i === current ? 'Now' : entry.done ? 'Saved' : 'Later'}
              last={i === current ? last : null}
              onReps={(v) => onReps(i, v)}
              onWeight={(v) => onWeight(i, v)}
            />
          );
        }
        return <SetLine key={i} n={i + 1} set={shown} done={entry.done} usesWeight={step.usesWeight} onPress={() => onOpen(i)} />;
      })}
      <PressableScale
        onPress={onAddSet}
        accessibilityRole="button"
        style={[styles.add, { borderTopColor: colors.borderSubtle }]}>
        <Icon name="plus" size={16} strokeWidth={2} color={colors.accentText} />
        <Text variant="label" tone="accent">
          Add a set
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: 12 },
  open: { padding: 12, gap: 12 },
  openHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  steppers: { flexDirection: 'row', gap: 8 },
  last: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
});
