import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { useSports } from '@/api/hooks';
import type { SportDefinition } from '@/api/types';
import { Text } from '@/components/ui';
import { ONBOARDING_ORDER, WIZARD_STEPS, type WizardStep } from '@/features/onboarding/order';
import { SECTION_META, sectionSummary } from '@/lib/preference-options';
import { SHELL_INSET } from '@/navigation/web/shell-metrics';
import { type OnboardingDraft, stepIsComplete, useOnboardingDraft } from '@/state/onboarding-draft';
import { useTheme } from '@/theme';

import { BrandMark } from './brand-mark';
import { useWizardJump } from './navigation';
import type { WizardPosition } from './position';
import { RAIL_STEP_PAD, RailStep, type RailStepState } from './rail-step';

const NOT_ANSWERED = 'Not answered yet';
/** Where the mark sits in the card, as in the app sidebar, so it stays put when Today opens. */
const CARD_PAD = { top: 14, x: 19 } as const;
/** Pulls the step rows out by their padding, so each marker centres under the 32-point mark. */
const STEPS_OFFSET = RAIL_STEP_PAD.x + 1 + 14 - 16;

const complete = (step: WizardStep, draft: OnboardingDraft) => step === 'review' || stepIsComplete(step, draft);

/**
 * A step's state in the rail. Steps up to the furthest one reached can be
 * reopened, except ahead of a step that still needs its answer (its Continue
 * is disabled, so the rail doesn't skip it either).
 */
function stateOf(index: number, current: number, furthest: number, draft: OnboardingDraft): RailStepState {
  if (index === current) return 'current';
  if (index > furthest) return 'locked';
  for (let i = Math.max(0, current); i < index; i++) {
    if (!complete(WIZARD_STEPS[i], draft)) return 'locked';
  }
  const step = WIZARD_STEPS[index];
  return step !== 'review' && index < furthest && complete(step, draft) ? 'done' : 'open';
}

/** The answer under a step's name, once the step has been reached. */
function summaryOf(step: WizardStep, state: RailStepState, draft: OnboardingDraft, sports?: SportDefinition[]) {
  if (step === 'review' || state === 'locked') return undefined;
  if (!stepIsComplete(step, draft)) return state === 'current' ? undefined : NOT_ANSWERED;
  return sectionSummary(step, draft, sports).value;
}

/** The questions' progress as segments, "2 of 5", like the phone's Steps bar. */
function RailProgress({ index }: { index: number }) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const total = ONBOARDING_ORDER.length;
  const filled = Math.min(Math.max(index + 1, 0), total);
  const caption = index >= total ? 'Ready to review' : `${filled} of ${total}`;
  return (
    <View style={styles.progress}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={caption}
        accessibilityValue={{ min: 0, max: total, now: filled }}
        style={styles.segments}>
        {ONBOARDING_ORDER.map((section, i) => (
          <Animated.View
            key={section}
            style={[
              styles.segment,
              {
                backgroundColor: i < filled ? colors.accent : colors.borderSubtle,
                transitionProperty: 'backgroundColor',
                transitionDuration: reduced ? 0 : motion.durSlow,
              },
            ]}
          />
        ))}
      </View>
      <Text variant="caption" aria-hidden>
        {caption}
      </Text>
    </View>
  );
}

export type WizardRailProps = {
  position: WizardPosition;
  /** The rail's slot, including the inset that floats the card. */
  width: number;
};

/**
 * The desktop wizard's rail, a floating card like the app sidebar: the Movo
 * mark, progress, and every step with its answer so far. Reached steps reopen
 * on click; the answers update as they are given.
 */
export function WizardRail({ position, width }: WizardRailProps) {
  const { colors, shadows } = useTheme();
  const [draft] = useOnboardingDraft();
  const sports = useSports();
  const jump = useWizardJump(position);
  const current = position.current ? WIZARD_STEPS.indexOf(position.current) : -1;

  return (
    <View style={[styles.slot, { width }]}>
      <View
        role="navigation"
        accessibilityLabel="Setup steps"
        style={[styles.card, shadows[1], { backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BrandMark />
          <View style={styles.intro}>
            <Text variant="subheading">Set up your plan</Text>
            <Text variant="bodySm">A few questions, then a gentle first week.</Text>
          </View>
          <RailProgress index={current} />
          <View style={styles.steps}>
            {WIZARD_STEPS.map((step, index) => {
              const state = stateOf(index, current, position.furthest, draft);
              const last = index === WIZARD_STEPS.length - 1;
              return (
                <RailStep
                  key={step}
                  number={index + 1}
                  label={step === 'review' ? 'Review' : SECTION_META[step].label}
                  summary={summaryOf(step, state, draft, sports.data)}
                  state={state}
                  connector={last ? 'none' : state === 'done' ? 'lit' : 'dim'}
                  onPress={() => jump(step)}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { paddingTop: SHELL_INSET, paddingBottom: SHELL_INSET, paddingLeft: SHELL_INSET },
  card: { flex: 1, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  content: { paddingTop: CARD_PAD.top, paddingHorizontal: CARD_PAD.x, paddingBottom: 20 },
  intro: { marginTop: 36, gap: 4 },
  progress: { marginTop: 20, gap: 8 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  steps: { marginTop: 20, marginHorizontal: -STEPS_OFFSET },
});
