import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Card, noBrowserOutline } from '@/components/ui';
import { Content, Screen } from '@/components/layout';
import { WIZARD_STEPS, type WizardStep } from '@/features/onboarding/order';
import { motion, useTheme } from '@/theme';

import { ASIDE_GAP, ASIDE_WIDTH, useWizardGeometry } from './geometry';

/** How far a step slides in: from the right going forward, from the left going back. */
const SLIDE = 28;
const ENTER_MS = 280;
const EASE_OUT = Easing.bezier(...motion.easeOut);

/** The step the wizard showed last, so the next one knows which way it came from. */
let lastShown = -1;

/** Fades and slides the stage in each time its screen gains focus (screens stay mounted on the web). */
function useStepEntrance(step: WizardStep) {
  const reduced = useReducedMotion();
  const index = WIZARD_STEPS.indexOf(step);
  const progress = useSharedValue(0);
  const shift = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      const forward = lastShown < 0 || index >= lastShown;
      lastShown = index;
      shift.set(reduced ? 0 : forward ? SLIDE : -SLIDE);
      progress.set(0);
      progress.set(withTiming(1, { duration: reduced ? 120 : ENTER_MS, easing: EASE_OUT }));
    }, [index, reduced, progress, shift]),
  );

  return useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateX: shift.get() * (1 - progress.get()) }],
  }));
}

/** Moves keyboard focus to the new step's card, so Tab starts at its top. Nothing scrolls. */
function useFocusOnEnter() {
  const ref = useRef<View>(null);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return;
      // React Native Web renders a View as a DOM element.
      const node = ref.current as unknown as HTMLElement | null;
      node?.focus?.({ preventScroll: true });
    }, []),
  );
  return ref;
}

export type WizardStageProps = {
  step: WizardStep;
  /** "Why we ask", beside the card on a wide window. */
  aside?: ReactNode;
  /** The card's content: the questions, then the actions. */
  children: ReactNode;
};

/**
 * One desktop wizard step: the card (at most 720 wide) and, where it fits,
 * the aside beside it, entering with a short slide in the direction of travel.
 */
export function WizardStage({ step, aside, children }: WizardStageProps) {
  const { shadows } = useTheme();
  const { showAside, maxWidth, cardPadding } = useWizardGeometry();
  const entrance = useStepEntrance(step);
  const focusRef = useFocusOnEnter();

  return (
    <Screen>
      <Content maxWidth={maxWidth} gap={0} contentContainerStyle={styles.page}>
        <Animated.View style={[styles.stage, entrance]}>
          <View ref={focusRef} tabIndex={-1} style={[styles.main, noBrowserOutline]}>
            <Card padding={cardPadding} style={[styles.card, shadows[2]]}>
              {children}
            </Card>
          </View>
          {showAside && aside ? <View style={styles.aside}>{aside}</View> : null}
        </Animated.View>
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 48 },
  stage: { flexDirection: 'row', alignItems: 'flex-start', gap: ASIDE_GAP },
  main: { flex: 1, minWidth: 0 },
  card: { gap: 32 },
  aside: { width: ASIDE_WIDTH, paddingTop: 8 },
});
