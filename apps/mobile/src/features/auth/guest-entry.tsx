import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Disc, Icon, PressableScale, Spinner, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { GUEST_PROMISE } from './auth-routes';

type GuestEntryProps = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Continue as guest (web only): one press makes a guest account that tries
 * every feature on the real API. A card-shaped action rather than another
 * pill, so it reads as its own way in beside the account options; hover
 * shifts the surface one step and nudges the arrow.
 */
export function GuestEntry({ onPress, loading = false, disabled = false }: GuestEntryProps) {
  const { colors, radius, fontFamily, motion } = useTheme();
  const reduced = useReducedMotion();
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel="Continue as guest"
      accessibilityHint={GUEST_PROMISE}
      aria-disabled={inactive}
      aria-busy={loading}
      style={({ pressed, hovered }) => [
        styles.entry,
        {
          borderRadius: radius.control,
          borderColor: hovered ? colors.accent : colors.borderStrong,
          backgroundColor: pressed || hovered ? colors.surfaceSunken : colors.surfaceCard,
          opacity: disabled ? 0.4 : 1,
        },
      ]}>
      {({ hovered }) => (
        <>
          <Disc icon="user-round" tone="accent" size={44} />
          <View style={styles.text}>
            <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 17, lineHeight: 22 }}>Continue as guest</Text>
            <Text variant="bodySm">{GUEST_PROMISE}</Text>
          </View>
          {loading ? (
            <Spinner size={20} color={colors.textSecondary} accessibilityLabel={null} />
          ) : (
            <Animated.View
              style={{
                transform: [{ translateX: hovered ? 3 : 0 }],
                transitionProperty: 'transform',
                transitionDuration: reduced ? 1 : motion.durBase,
              }}>
              <Icon name="arrow-right" size={20} color={hovered ? colors.accentText : colors.textSecondary} />
            </Animated.View>
          )}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 18,
    borderWidth: 1,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
