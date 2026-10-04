import { useRef } from 'react';
import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';
import { useArrowKeyRadios } from './web-keyboard';

export type SegmentedOption<T> = {
  value: T;
  label: string;
  /** Small unit under a big number ("min"); makes the segment 68 high. */
  unit?: string;
};

export type SegmentedProps<T extends string | number | boolean> = {
  /** Read as the group's name. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Single choice between a few short options, equal widths; the selected one
 * uses the Radio card's checked style. On the web it is one tab stop (the
 * selected option) and the arrow keys move the choice.
 */
export function Segmented<T extends string | number | boolean>({ label, options, value, onChange, style }: SegmentedProps<T>) {
  const { colors, radius, fontFamily } = useTheme();
  const group = useRef<View>(null);
  useArrowKeyRadios(group);
  const selected = options.findIndex((option) => option.value === value);
  // Roving focus: Tab lands on the chosen option, or the first when none is.
  const tabStop = Math.max(0, selected);

  return (
    <View ref={group} accessibilityRole="radiogroup" accessibilityLabel={label} style={[{ flexDirection: 'row', gap: 8 }, style]}>
      {options.map((option, index) => {
        const on = index === selected;
        return (
          <PressableScale
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.unit ? `${option.label} ${option.unit}` : option.label}
            aria-checked={on}
            tabIndex={Platform.OS === 'web' ? (index === tabStop ? 0 : -1) : undefined}
            style={({ pressed, hovered }) => ({
              flex: 1,
              minWidth: 0,
              height: option.unit ? 68 : 48,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              borderRadius: radius.md,
              // Pressed (or hovered, on the web) sinks like a RadioCard or Tag.
              backgroundColor: on ? colors.accentSoft : pressed || hovered ? colors.surfaceSunken : colors.surfaceCard,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? colors.accent : colors.borderStrong,
            })}>
            <Text
              tabular
              numberOfLines={1}
              style={
                option.unit
                  ? { fontFamily: fontFamily.displaySemibold, fontSize: 24, lineHeight: 26 }
                  : { fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 20 }
              }>
              {option.label}
            </Text>
            {option.unit ? (
              <Text variant="caption" tone={on ? 'accent' : 'tertiary'}>
                {option.unit}
              </Text>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}
