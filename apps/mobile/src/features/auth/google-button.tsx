import { StyleSheet, View } from 'react-native';

import { PressableScale, Spinner, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { GoogleMark } from './google-mark';

type GoogleButtonProps = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Continue with Google: the kit's secondary lg Button, composed here because the
 * kit Button takes Lucide icons only and Google's mark has to keep its own colours.
 */
export function GoogleButton({ onPress, loading = false, disabled = false }: GoogleButtonProps) {
  const { colors, fontFamily } = useTheme();
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      aria-disabled={inactive} aria-busy={loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? colors.surfaceSunken : colors.surfaceCard,
          borderColor: colors.borderStrong,
          opacity: disabled ? 0.4 : 1,
        },
      ]}>
      <View style={styles.row}>
        {loading ? <Spinner size={20} color={colors.textPrimary} accessibilityLabel={null} /> : <GoogleMark />}
        <Text
          numberOfLines={1}
          style={{ fontFamily: fontFamily.bodySemibold, fontSize: 18, lineHeight: 22, color: colors.textPrimary }}>
          Continue with Google
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    paddingHorizontal: 26,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
