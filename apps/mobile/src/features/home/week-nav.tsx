import { View } from 'react-native';

import { Button, IconButton, Text } from '@/components/ui';

type WeekNavProps = {
  /** "5–11 Oct · this week" */
  label: string;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  /** Why › is off: "Next week is planned on Sunday" or "Plans go one week ahead". */
  nextHint: string;
  /** Away from this week, jumps back to it. */
  onThisWeek: (() => void) | null;
};

/**
 * Which week the strip shows. ‹ goes back through every past week to the first;
 * › only to a week that is already planned, at most one ahead.
 */
export function WeekNav({ label, onPrev, onNext, nextHint, onThisWeek }: WeekNavProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36, marginRight: -6 }}>
      <Text variant="label" tone="secondary" tabular numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
        {label}
      </Text>
      {onThisWeek ? (
        <Button variant="ghost" size="sm" onPress={onThisWeek} style={{ marginRight: 2 }}>
          This week
        </Button>
      ) : null}
      <IconButton
        icon="chevron-left"
        size="sm"
        accessibilityLabel={onPrev ? 'Previous week' : 'No earlier weeks'}
        disabled={!onPrev}
        onPress={onPrev ?? undefined}
      />
      <IconButton
        icon="chevron-right"
        size="sm"
        accessibilityLabel={onNext ? 'Next week' : nextHint}
        disabled={!onNext}
        onPress={onNext ?? undefined}
      />
    </View>
  );
}
