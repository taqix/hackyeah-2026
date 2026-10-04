import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useLayout } from '@/components/layout';
import { useTheme } from '@/theme';

export type WizardSkip = {
  onPress: () => void;
  /** What skipping leaves out, for screen readers. */
  hint: string;
};

export type WizardActionsProps = {
  /** Left out on the first step. */
  onBack?: () => void;
  /** A quiet Skip beside the main action (Good to know). */
  skip?: WizardSkip;
  primaryLabel: string;
  onPrimary: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** A line above the buttons, such as Review's failure. */
  note?: ReactNode;
};

/** "Press Enter" beside the main action: the wizard's shortcut, for the eye only. */
function EnterHint() {
  const { colors, fontFamily } = useTheme();
  return (
    <View aria-hidden style={styles.hint}>
      <Text variant="caption">Press</Text>
      <View style={[styles.key, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSunken }]}>
        <Text variant="caption" style={{ fontFamily: fontFamily.bodySemibold, color: colors.textSecondary }}>
          Enter
        </Text>
      </View>
    </View>
  );
}

/** The end of a desktop wizard card: Back on the left, the main action (and Skip) on the right. */
export function WizardActions({
  onBack,
  skip,
  primaryLabel,
  onPrimary,
  disabled = false,
  loading = false,
  note,
}: WizardActionsProps) {
  const { colors } = useTheme();
  const { isWide } = useLayout();
  return (
    <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
      {note}
      <View style={styles.row}>
        {onBack ? (
          <Button variant="secondary" icon="arrow-left" onPress={onBack}>
            Back
          </Button>
        ) : null}
        <View style={styles.spacer} />
        {isWide && !disabled && !loading ? <EnterHint /> : null}
        {skip ? (
          <Button variant="ghost" onPress={skip.onPress} accessibilityHint={skip.hint}>
            Skip
          </Button>
        ) : null}
        <Button iconRight="arrow-right" disabled={disabled} loading={loading} onPress={onPrimary}>
          {primaryLabel}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { borderTopWidth: 1, paddingTop: 24, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spacer: { flex: 1 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 4 },
  key: { height: 22, paddingHorizontal: 6, borderWidth: 1, borderBottomWidth: 2, borderRadius: 6, justifyContent: 'center' },
});
