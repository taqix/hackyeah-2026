import { View, type ViewProps } from 'react-native';

export type StackProps = ViewProps & {
  /** 12 by default (stack gap). */
  gap?: number;
};

/** Vertical stack with a gap. */
export function Col({ gap = 12, style, ...rest }: StackProps) {
  return <View {...rest} style={[{ gap }, style]} />;
}

/** Horizontal stack with a gap, vertically centred. */
export function Row({ gap = 12, style, ...rest }: StackProps) {
  return <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} />;
}
