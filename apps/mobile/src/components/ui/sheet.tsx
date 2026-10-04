import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { KeyboardAvoider, useKeyboardLifted } from '@/components/layout/keyboard-avoider';
import { useLayout } from '@/components/layout/responsive';
import { useTheme } from '@/theme';

import { useFocusReturn } from './focus-return';
import { noBrowserOutline } from './focus-visible';
import { IconButton } from './icon-button';
import { Text } from './text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The desktop dialog's widest. */
const DIALOG_MAX_WIDTH = 520;
/** Room the dialog keeps from the window's edges, and its own padding. */
const DIALOG_MARGIN = 32;
const DIALOG_PADDING = 24;
/** The size the dialog grows from as it fades in. */
const DIALOG_FROM_SCALE = 0.96;

export type SheetProps = {
  visible: boolean;
  /** Overlay tap, Android back and the iOS escape gesture all call this; on the web, Escape too. */
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

type HeadProps = Pick<SheetProps, 'title' | 'description' | 'showClose' | 'onClose'> & { style?: StyleProp<ViewStyle> };

/** Title, description and the close button, when the sheet has any of them. */
function Head({ title, description, showClose, onClose, style }: HeadProps) {
  if (!title && !showClose) return null;
  return (
    <View style={[styles.head, style]}>
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
  );
}

/** The home-indicator space under a sheet's content; while the keyboard is up the sheet sits on it instead. */
function SafeFoot() {
  const insets = useSafeAreaInsets();
  const lifted = useKeyboardLifted();
  return <View aria-hidden style={{ height: lifted ? 0 : insets.bottom }} />;
}

type LayerProps = Omit<SheetProps, 'visible'> & { progress: SharedValue<number> };

/** Phones (and the narrow web): the bottom sheet with its handle, sliding up over the dim. */
function BottomSheet({ progress, onClose, title, description, label, showClose, children }: LayerProps) {
  const { colors, radius, shadows, layout } = useTheme();
  const panelHeight = useSharedValue(600);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * panelHeight.get() }],
  }));

  return (
    <>
      {/* The dim covers the whole screen, keyboard area included; only the panel rides up. */}
      <AnimatedPressable
        onPress={onClose}
        aria-hidden
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, overlayStyle]}
      />
      <KeyboardAvoider style={styles.end}>
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
            },
            panelStyle,
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          <Head title={title} description={description} showClose={showClose} onClose={onClose} />
          {children}
          <SafeFoot />
        </Animated.View>
      </KeyboardAvoider>
    </>
  );
}

/**
 * The desktop web: a centered dialog that grows in and fades, over the dim.
 * A click on the dim or Escape closes it; React Native Web's modal keeps Tab
 * inside and hands focus back to the opener. The dim takes no focus, so focus
 * starts on the dialog itself: the first Tab reaches its first control, and
 * Enter cannot confirm anything by accident. Long content scrolls inside.
 */
function Dialog({ progress, onClose, title, description, label, showClose, children }: LayerProps) {
  const { colors, radius, shadows } = useTheme();
  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const dialogStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: DIALOG_FROM_SCALE + (1 - DIALOG_FROM_SCALE) * progress.get() }],
  }));
  const hasHead = !!title || !!showClose;

  return (
    <>
      {/* A responder, not a pressable: a pressable would be the first thing the modal focuses. */}
      <Animated.View
        aria-hidden
        onStartShouldSetResponder={() => true}
        onResponderRelease={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, overlayStyle]}
      />
      <View style={styles.center}>
        <Animated.View
          tabIndex={-1}
          accessibilityLabel={label ?? title}
          style={[
            styles.dialog,
            shadows[3],
            { backgroundColor: colors.surfaceRaised, borderRadius: radius.card },
            noBrowserOutline,
            dialogStyle,
          ]}>
          <Head
            title={title}
            description={description}
            showClose={showClose}
            onClose={onClose}
            style={styles.dialogHead}
          />
          <ScrollView
            style={styles.dialogScroll}
            contentContainerStyle={[styles.dialogBody, hasHead ? styles.dialogBodyUnderHead : null]}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </>
  );
}

/**
 * Bottom sheet over a dimmed screen: raised surface, 32 radius on top, grab
 * handle, safe-area padding. Slides up (320 ms ease-in-out); appears in place
 * under reduced motion. It rides above the keyboard on iOS and Android
 * (KeyboardAvoider: the modal is its own window, outside the Screen's). On the
 * desktop web (from 768 px) the same sheet is a centered dialog, 520 wide.
 */
export function Sheet({ visible, onClose, title, description, label, showClose = false, children }: SheetProps) {
  const { motion } = useTheme();
  const { isDesktop } = useLayout();
  const reduced = useReducedMotion();
  // Stays true through the closing slide so the Modal unmounts after it.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const open = reduced ? visible : mounted;
  useFocusReturn(open);

  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.set(visible ? 1 : 0);
      return;
    }
    // The dialog's grow-and-fade is UI feedback (200 ms ease-out); the sheet's slide is 320 ms ease-in-out.
    const timing = isDesktop
      ? { duration: motion.durBase, easing: Easing.bezier(...motion.easeOut) }
      : { duration: motion.durSlow, easing: Easing.bezier(...motion.easeInOut) };
    progress.set(
      withTiming(visible ? 1 : 0, timing, (finished) => {
        if (finished && !visible) scheduleOnRN(setMounted, false);
      }),
    );
  }, [visible, reduced, progress, motion, isDesktop]);

  const layer = { progress, onClose, title, description, label, showClose, children };
  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      // The web's dialog element is the modal itself: name it there.
      {...(Platform.OS === 'web' ? { 'aria-label': label ?? title } : null)}>
      <GestureHandlerRootView style={styles.fill}>
        {isDesktop ? <Dialog {...layer} /> : <BottomSheet {...layer} />}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  end: { justifyContent: 'flex-end' },
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: DIALOG_MARGIN,
    // Clicks beside the dialog reach the dim.
    pointerEvents: 'box-none',
  },
  dialog: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  dialogHead: {
    paddingTop: DIALOG_PADDING,
    paddingHorizontal: DIALOG_PADDING + 4,
  },
  dialogScroll: { flexGrow: 0, flexShrink: 1 },
  dialogBody: {
    gap: 16,
    padding: DIALOG_PADDING,
  },
  dialogBodyUnderHead: { paddingTop: 16 },
});
