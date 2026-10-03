import { type ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

import { IconButton } from './icon-button';
import { Text } from './text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type SheetProps = {
  visible: boolean;
  /** Overlay tap, Android back and the iOS escape gesture all call this. */
  onClose: () => void;
  /** Heading at the top of the sheet. */
  title?: string;
  /** Short line under the title. */
  description?: string;
  /** Names the dialog for screen readers; defaults to the title. */
  label?: string;
  /** Adds a close (x) button beside the title. */
  showClose?: boolean;
  children?: ReactNode;
};

/**
 * Bottom sheet over a dimmed screen: raised surface, 32 radius on top, grab
 * handle, safe-area padding. Slides up (320 ms ease-in-out); appears in place
 * under reduced motion.
 */
export function Sheet({ visible, onClose, title, description, label, showClose = false, children }: SheetProps) {
  const { colors, radius, shadows, layout, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // Stays true through the closing slide so the Modal unmounts after it.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const open = reduced ? visible : mounted;

  const progress = useSharedValue(0);
  const panelHeight = useSharedValue(600);

  useEffect(() => {
    if (reduced) {
      progress.set(visible ? 1 : 0);
      return;
    }
    const timing = { duration: motion.durSlow, easing: Easing.bezier(...motion.easeInOut) };
    progress.set(
      withTiming(visible ? 1 : 0, timing, (finished) => {
        if (finished && !visible) scheduleOnRN(setMounted, false);
      }),
    );
  }, [visible, reduced, progress, motion]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * panelHeight.get() }],
  }));

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.end}>
          <AnimatedPressable
            onPress={onClose}
            accessible={false}
            importantForAccessibility="no"
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, overlayStyle]}
          />
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={label ?? title}
            onAccessibilityEscape={onClose}
            onLayout={(event) => panelHeight.set(event.nativeEvent.layout.height)}
            style={[
              styles.panel,
              shadows[3],
              {
                backgroundColor: colors.surfaceRaised,
                borderTopLeftRadius: radius.sheet,
                borderTopRightRadius: radius.sheet,
                paddingHorizontal: layout.gutter,
                paddingBottom: insets.bottom + 16,
              },
              panelStyle,
            ]}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            {title || showClose ? (
              <View style={styles.head}>
                <View style={styles.headText}>
                  {title ? (
                    <Text variant="heading" accessibilityRole="header">
                      {title}
                    </Text>
                  ) : null}
                  {description ? <Text tone="secondary">{description}</Text> : null}
                </View>
                {showClose ? <IconButton icon="x" accessibilityLabel="Close" onPress={onClose} /> : null}
              </View>
            ) : null}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  end: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    paddingTop: 10,
    gap: 16,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 4,
  },
  headText: { flex: 1, minWidth: 0, gap: 8 },
});
