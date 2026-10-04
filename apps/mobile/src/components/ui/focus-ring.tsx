import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** The kit's focus ring (README › Focus): 3 px of focus-ring, 2 px out from the shape. */
export const FOCUS_RING_WIDTH = 3;
export const FOCUS_RING_OFFSET = 2;
const OUT = FOCUS_RING_WIDTH + FOCUS_RING_OFFSET;

/**
 * The focus ring as a view, for a pressable whose visible shape is smaller than
 * its touch area (a calendar day's circle in a wider cell): put it inside the
 * shape, give the shape's corner radius, and give the pressable
 * `focusRing="none"` so the browser's square outline goes.
 */
export function FocusRing({ radius }: { radius: number }) {
  const { colors } = useTheme();
  return (
    <View
      aria-hidden
      style={[styles.ring, { borderRadius: radius + OUT, borderColor: colors.focusRing }]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -OUT,
    right: -OUT,
    bottom: -OUT,
    left: -OUT,
    borderWidth: FOCUS_RING_WIDTH,
    pointerEvents: 'none',
  },
});
