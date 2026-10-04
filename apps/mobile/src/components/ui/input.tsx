import { type ReactNode, type Ref, useState } from 'react';
import {
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

import { noBrowserOutline } from './focus-visible';
import { IconButton } from './icon-button';
import { Text } from './text';

export type InputProps = Omit<TextInputProps, 'style' | 'secureTextEntry' | 'placeholderTextColor'> & {
  label?: string;
  hint?: string;
  /** Turns the border red and replaces the hint; announced when it appears. */
  error?: string | null;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Password entry with a show/hide eye button. */
  secure?: boolean;
  ref?: Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

function Affix({ children }: { children: ReactNode }) {
  if (typeof children === 'string' || typeof children === 'number') {
    return <Text variant="label" tone="tertiary">{children}</Text>;
  }
  return <>{children}</>;
}

/**
 * Text field (DS Input): 52 high, radius 18, border-strong outline that turns
 * accent with a soft focus ring, danger on error. Props not listed pass to
 * TextInput (inputMode, autoComplete, textContentType, returnKeyType, …).
 */
export function Input({
  label,
  hint,
  error,
  prefix,
  suffix,
  secure = false,
  editable = true,
  multiline = false,
  ref,
  style,
  inputStyle,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...rest
}: InputProps) {
  const { colors, radius, type } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const note = error || hint;
  const border = error ? colors.danger : focused ? colors.accent : colors.borderStrong;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text variant="label" tone="secondary">
          {label}
        </Text>
      ) : null}
      <View>
        {focused ? (
          <View
            style={[styles.ring, { pointerEvents: 'none', borderRadius: radius.control + 4, borderColor: colors.focusRing }]}
          />
        ) : null}
        <View
          style={[
            styles.field,
            multiline ? styles.multiline : null,
            {
              borderRadius: radius.control,
              borderColor: border,
              backgroundColor: editable ? colors.surfaceCard : colors.surfaceSunken,
              opacity: editable ? 1 : 0.6,
            },
          ]}>
          {prefix != null ? <Affix>{prefix}</Affix> : null}
          <TextInput
            {...rest}
            ref={ref}
            editable={editable}
            multiline={multiline}
            secureTextEntry={secure && !revealed}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityHint={note ?? undefined}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={[
              // No lineHeight on one line: iOS shifts single-line text when it is set.
              { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize },
              styles.input,
              multiline ? [styles.inputMultiline, { lineHeight: type.body.lineHeight }] : null,
              { color: colors.textPrimary },
              inputStyle,
            ]}
          />
          {suffix != null ? <Affix>{suffix}</Affix> : null}
          {secure ? (
            <IconButton
              icon={revealed ? 'eye-off' : 'eye'}
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              color={colors.textSecondary}
              onPress={() => setRevealed((value) => !value)}
              style={styles.eye}
            />
          ) : null}
        </View>
      </View>
      {note ? (
        <Text
          variant="caption"
          tone={error ? 'danger' : 'tertiary'}
          accessibilityRole={error ? 'alert' : undefined}
          accessibilityLiveRegion={error ? 'polite' : 'none'}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  ring: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
  },
  multiline: {
    height: undefined,
    minHeight: 104,
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    // The field draws its own focus ring; hide the browser's square one inside it.
    ...noBrowserOutline,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  eye: { marginRight: -12 },
});
