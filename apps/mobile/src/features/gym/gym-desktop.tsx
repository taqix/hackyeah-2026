import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Content, Section, useLayout } from '@/components/layout';
import { Button, Card, IconButton, Kbd, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import type { GymState } from './model';
import { PlanMinutes, PlanNote, PlanSteps } from './plan-sheet';
import { Elapsed } from './session-top';

/** The plan column needs this much window beside the stage; narrower, it stays behind the plan button. */
const PLAN_BESIDE_MIN_WIDTH = 1024;
const PLAN_WIDTH = 340;

export type KeyHint = { keys: string[]; label: string };

export type GymDesktopProps = {
  title: string;
  startedAt: number;
  plannedMinutes: number;
  state: GymState;
  lastWeight: number | null;
  onPlan: () => void;
  onEnd: () => void;
  onGoTo: (exercise: number) => void;
  /** The exercise and its sets or countdown, or the rest. */
  stage: ReactNode;
  /** The main buttons under the stage; the rest brings its own. */
  actions: ReactNode;
  hints: KeyHint[];
};

/** Plan button (when the plan is not beside the stage) and title, the session clock, End session. */
function FocusTop({ title, startedAt, onPlan, onEnd }: { title: string; startedAt: number; onPlan?: () => void; onEnd: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.top, { borderBottomColor: colors.borderSubtle }]}>
      <View style={styles.topSide}>
        {onPlan ? <IconButton icon="list-checks" accessibilityLabel="Session plan" onPress={onPlan} /> : null}
        <Text variant="subheading" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      </View>
      <Elapsed startedAt={startedAt} />
      <View style={[styles.topSide, styles.topEnd]}>
        <Button variant="secondary" size="sm" icon="x" onPress={onEnd}>
          End session
        </Button>
      </View>
    </View>
  );
}

function KeyHints({ hints }: { hints: KeyHint[] }) {
  return (
    <View style={styles.hints}>
      {hints.map((hint) => (
        <View key={hint.label} style={styles.hint}>
          {hint.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
          <Text variant="caption">{hint.label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The guided gym (6.3–6.7) as a focus screen on the desktop web: no sidebar,
 * the exercise centred with its countdown or sets, today's plan beside it when
 * the window is wide enough, and the keyboard shortcuts named under the buttons.
 */
export function GymDesktop({
  title,
  startedAt,
  plannedMinutes,
  state,
  lastWeight,
  onPlan,
  onEnd,
  onGoTo,
  stage,
  actions,
  hints,
}: GymDesktopProps) {
  const { width } = useLayout();
  const beside = width >= PLAN_BESIDE_MIN_WIDTH;
  return (
    <>
      <FocusTop title={title} startedAt={startedAt} onPlan={beside ? undefined : onPlan} onEnd={onEnd} />
      <Content gap={0} maxWidth={beside ? 1120 : 640} contentContainerStyle={styles.page}>
        <View style={[styles.body, beside ? styles.split : null]}>
          <View style={styles.stage}>
            {stage}
            {actions ? <View style={styles.actions}>{actions}</View> : null}
            {hints.length ? <KeyHints hints={hints} /> : null}
          </View>
          {beside ? (
            <Card padding={20} style={styles.plan}>
              <View style={styles.planHead}>
                <Section>Today&apos;s plan</Section>
                <PlanMinutes startedAt={startedAt} plannedMinutes={plannedMinutes} />
              </View>
              <View style={styles.planSteps}>
                <PlanSteps state={state} lastWeight={lastWeight} onGoTo={onGoTo} />
              </View>
              <PlanNote />
            </Card>
          ) : null}
        </View>
      </Content>
    </>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 64,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  topSide: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  topEnd: { justifyContent: 'flex-end' },
  title: { flexShrink: 1 },
  // Short content sits in the middle of the window; a long set list scrolls.
  page: { flexGrow: 1, justifyContent: 'center' },
  body: { gap: 32 },
  split: { flexDirection: 'row', alignItems: 'flex-start' },
  stage: { flex: 1, minWidth: 0, gap: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hints: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 20, rowGap: 8 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plan: { width: PLAN_WIDTH, gap: 12 },
  planHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 },
  planSteps: { gap: 2 },
});
