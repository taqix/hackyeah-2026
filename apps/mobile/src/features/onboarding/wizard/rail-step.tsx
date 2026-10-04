import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Icon, PressableScale, Text } from '@/components/ui';
import { activeNavFill } from '@/navigation/nav-colors';
import { useTheme } from '@/theme';

/**
 * current: on screen. done: answered and passed. open: reached, but not
 * passed or not answered yet. locked: not reached yet.
 */
export type RailStepState = 'current' | 'done' | 'open' | 'locked';

const MARKER = 28;
/** The row's padding; the rail offsets the list by it so markers line up with the mark above. */
export const RAIL_STEP_PAD = { x: 8, y: 8 } as const;

function Marker({ number, state }: { number: number; state: RailStepState }) {
  const { colors, fontFamily, motion } = useTheme();
  const reduced = useReducedMotion();
  const look = {
    current: { fill: colors.accent, edge: colors.accent, ink: colors.textOnAccent },
    done: { fill: colors.accentSoftStrong, edge: colors.accentSoftStrong, ink: colors.accentText },
    open: { fill: colors.surfaceCard, edge: colors.borderStrong, ink: colors.textPrimary },
    locked: { fill: colors.surfaceCard, edge: colors.borderSubtle, ink: colors.textTertiary },
  }[state];
  return (
    <Animated.View
      aria-hidden
      style={[
        styles.marker,
        {
          backgroundColor: look.fill,
          borderColor: look.edge,
          transitionProperty: ['backgroundColor', 'borderColor'],
          transitionDuration: reduced ? 0 : motion.durBase,
        },
      ]}>
      {state === 'done' ? (
        <Icon name="check" size={15} strokeWidth={2.5} color={look.ink} />
      ) : (
        <Text tabular style={{ fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 16, color: look.ink }}>
          {number}
        </Text>
      )}
    </Animated.View>
  );
}

export type RailStepProps = {
  number: number;
  label: string;
  /** The answer so far, in one line under the label. */
  summary?: string;
  state: RailStepState;
  /** The line down to the next step: lit once this step is done; none after the last. */
  connector: 'none' | 'lit' | 'dim';
  onPress: () => void;
};

/**
 * One step in the wizard's rail: its marker, name and answer. Like the app
 * sidebar's items, the current one sits on the nav pill and the others take a
 * wash on hover; reached steps open on click.
 */
export function RailStep({ number, label, summary, state, connector, onPress }: RailStepProps) {
  const { colors, fontFamily } = useTheme();
  const locked = state === 'locked';
  const current = state === 'current';
  const spoken = [label, summary, current ? 'current step' : null].filter(Boolean).join(', ');

  return (
    <PressableScale
      onPress={current ? undefined : onPress}
      disabled={locked}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={current || locked ? undefined : 'Opens this step'}
      style={({ hovered }) => [
        styles.row,
        current ? activeNavFill(colors) : hovered ? { backgroundColor: colors.hoverWash } : null,
      ]}>
      {connector !== 'none' ? (
        <View
          aria-hidden
          style={[styles.line, { backgroundColor: connector === 'lit' ? colors.accent : colors.borderSubtle }]}
        />
      ) : null}
      <Marker number={number} state={state} />
      <View style={styles.words}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: current ? fontFamily.bodySemibold : fontFamily.bodyMedium,
            fontSize: 15,
            lineHeight: 20,
            color: locked ? colors.textTertiary : colors.textPrimary,
          }}>
          {label}
        </Text>
        {summary ? (
          <Text variant="caption" numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: MARKER + RAIL_STEP_PAD.y * 2,
    paddingVertical: RAIL_STEP_PAD.y,
    paddingHorizontal: RAIL_STEP_PAD.x,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, minWidth: 0, gap: 1, paddingTop: 4 },
  /*
   * From 3 points under this marker to 3 points above the next row's. Offsets
   * count from inside the row's 1-point border, which the next row has too.
   */
  line: {
    position: 'absolute',
    left: RAIL_STEP_PAD.x + MARKER / 2 - 1,
    top: RAIL_STEP_PAD.y + MARKER + 3,
    bottom: -(RAIL_STEP_PAD.y + 2 - 3),
    width: 2,
    borderRadius: 1,
  },
});
