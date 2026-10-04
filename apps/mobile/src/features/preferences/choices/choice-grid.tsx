import type { ReactNode } from 'react';
import { View } from 'react-native';

import { TileGrid } from './tile-grid';

export type ChoiceGridProps = {
  /** Read as the group's name (usually the question). */
  label: string;
  /** radio: one answer (a radiogroup); checkbox: any number (a group). */
  kind: 'radio' | 'checkbox';
  /** Narrowest a card gets before the grid drops a column. */
  minItemWidth: number;
  children: ReactNode;
};

/** OptionCards of one question in equal columns, read as one group by assistive tech. */
export function ChoiceGrid({ label, kind, minItemWidth, children }: ChoiceGridProps) {
  return (
    <View role={kind === 'radio' ? 'radiogroup' : 'group'} accessibilityLabel={label}>
      <TileGrid minItemWidth={minItemWidth}>{children}</TileGrid>
    </View>
  );
}
