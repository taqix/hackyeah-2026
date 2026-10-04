import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon, noBrowserOutline, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { formatKg } from './format';

const BUTTON = 40;
const SLOP = 2;

export type NumberStepperProps = {
  /** 'Weight', 'Reps': names the group and the buttons. */
  label: string;
  /** null shows an empty field (no weight yet). */
  value: number | null;
  unit: string;
  onChange: (value: number | null) => void;
  /** The exercise's step: reps 1, dumbbells 2 kg. */
  step?: number;
  min?: number;
  /** Weights take fractions ('12.5'); reps and seconds are whole. */
  decimal?: boolean;
  /** Whether clearing the field leaves it empty (weight) or keeps the number (reps). */
  allowEmpty?: boolean;
};

function parse(text: string, decimal: boolean): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = decimal ? Number.parseFloat(t) : Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * − value + . Value and unit stack so '10 reps' fits a half-width stepper.
 * Tapping the number opens the numeric keypad; typed numbers apply as you type.
 */
export function NumberStepper({
  label,
  value,
  unit,
  onChange,
  step = 1,
  min = 0,
  decimal = false,
  allowEmpty = false,
}: NumberStepperProps) {
  const { colors, fontFamily, radius } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const shown = draft ?? (value == null ? '' : decimal ? formatKg(value) : String(value));
  const nudge = (dir: 1 | -1) => {
    const base = value ?? (dir > 0 ? 0 : min);
    const next = Math.max(min, Math.round((base + dir * step) * 10) / 10);
    setDraft(null);
    onChange(value == null && dir > 0 ? Math.max(min, step) : next);
  };
  const button = (dir: 1 | -1) => {
    const disabled = dir < 0 && (value == null || value <= min);
    return (
      <PressableScale
        onPress={() => nudge(dir)}
        disabled={disabled}
        hitSlop={SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${dir < 0 ? 'Decrease' : 'Increase'} ${label.toLowerCase()}`}
        aria-disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? colors.borderSubtle : colors.surfaceSunken, opacity: disabled ? 0.4 : 1 },
        ]}>
        <Icon name={dir < 0 ? 'minus' : 'plus'} size={20} strokeWidth={2} color={colors.textPrimary} />
      </PressableScale>
    );
  };

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={label}
      style={[
        styles.box,
        {
          borderRadius: radius.control,
          backgroundColor: colors.surfaceCard,
          borderColor: focused ? colors.accent : colors.borderStrong,
        },
      ]}>
      {/* Typing a number: the Input's accent border and soft ring, around the whole stepper. */}
      {focused ? (
        <View style={[styles.ring, { borderRadius: radius.control + 4, borderColor: colors.focusRing }]} />
      ) : null}
      {button(-1)}
      <View style={styles.middle}>
        <TextInput
          value={shown}
          placeholder="–"
          placeholderTextColor={colors.textTertiary}
          onFocus={() => {
            setFocused(true);
            setDraft(shown);
          }}
          onBlur={() => {
            setFocused(false);
            setDraft(null);
          }}
          onChangeText={(text) => {
            setDraft(text);
            const n = parse(text, decimal);
            if (n === null && allowEmpty) onChange(null);
            else if (n != null) onChange(Math.max(min, n));
          }}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          inputMode={decimal ? 'decimal' : 'numeric'}
          returnKeyType="done"
          selectTextOnFocus
          maxLength={5}
          accessibilityLabel={`${label}, ${value == null ? 'empty' : `${shown} ${unit}`}`}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              fontFamily: fontFamily.displaySemibold,
              fontSize: shown.length > 3 ? 18 : 22,
            },
          ]}
        />
        <Text variant="caption" numberOfLines={1}>
          {unit}
        </Text>
      </View>
      {button(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 60,
    padding: 6,
    borderWidth: 1,
  },
  ring: {
    position: 'absolute',
    top: -5,
    right: -5,
    bottom: -5,
    left: -5,
    borderWidth: 4,
    pointerEvents: 'none',
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
  },
  input: {
    alignSelf: 'stretch',
    textAlign: 'center',
    padding: 0,
    margin: 0,
    lineHeight: 24,
    height: 26,
    fontVariant: ['tabular-nums'],
    // The stepper draws its own focus ring; hide the browser's square one around the number.
    ...noBrowserOutline,
  },
});
