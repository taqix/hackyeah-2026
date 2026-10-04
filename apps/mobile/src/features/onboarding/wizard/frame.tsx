import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useLayout } from '@/components/layout';
import { useTheme } from '@/theme';

import { useWizardGeometry } from './geometry';
import { useWizardPosition } from './position';
import { WizardRail } from './rail';

type FrameProps = { children: ReactNode };

/**
 * The web page around onboarding's stack: from the medium breakpoint the
 * wizard rail sits at the left. The stack keeps its place in the tree at
 * every width, so crossing a breakpoint doesn't remount the steps.
 */
function WebFrame({ children }: FrameProps) {
  const { colors } = useTheme();
  const { isDesktop } = useLayout();
  const { railWidth } = useWizardGeometry();
  const position = useWizardPosition();
  return (
    <View style={[styles.frame, { backgroundColor: colors.bgApp }]}>
      {isDesktop ? <WizardRail position={position} width={railWidth} /> : null}
      <View style={styles.main}>{children}</View>
    </View>
  );
}

/** iOS and Android: the stack alone, exactly as before. */
function NativeFrame({ children }: FrameProps) {
  return children;
}

export const OnboardingFrame = Platform.OS === 'web' ? WebFrame : NativeFrame;

const styles = StyleSheet.create({
  frame: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
});
