/** 8.2 Updating, 8.12–8.14 problems, and the day separator. */
import { View } from 'react-native';

import { Button, Skeleton, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { Band, Head, Small, Strong, Surface, useAnnounce } from './parts';

const KEEPS = 'Your current plan stays as it is until the new one is ready.';

function SkeletonRow({ short = false }: { short?: boolean }) {
  return (
    <Band gap={0} style={{ flexDirection: 'row', gap: 12, paddingVertical: 14 }}>
      <View style={{ width: 44, gap: 7 }}>
        <Skeleton width={28} height={12} radius={99} />
        <Skeleton width={40} height={10} radius={99} />
      </View>
      <View style={{ flex: 1, gap: 9 }}>
        <Skeleton width={short ? '52%' : '74%'} height={14} radius={99} />
        <Skeleton width={short ? '36%' : '58%'} height={12} radius={99} />
      </View>
    </Band>
  );
}

/** 8.2: while a change runs, the plan in use stays active until the new one passes checks. */
export function UpdatingCard() {
  useAnnounce('Updating your plan');
  return (
    <Surface
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Updating your plan. ${KEEPS}`}
      accessibilityState={{ busy: true }}
      aria-live="polite">
      <Band divider={false} style={{ paddingTop: 16, paddingBottom: 14 }}>
        <Head icon="loader-circle" tone="accent" title="Updating your plan" spin />
        <Small>{KEEPS}</Small>
      </Band>
      <SkeletonRow />
      <SkeletonRow short />
    </Surface>
  );
}

export type ProblemKind = 'failed' | 'stale' | 'offline';

export type ProblemCardProps = {
  /** failed: 8.12, stale: 8.13 (changed elsewhere), offline: 8.14 (message waits, unsent). */
  kind: ProblemKind;
  /** Try again resends the message. */
  onRetry: () => void;
  /** Edit message puts it back in the box. */
  onEdit: () => void;
};

const PROBLEMS = {
  failed: {
    icon: 'circle-alert',
    tone: 'danger',
    title: "Couldn't update your plan",
    lead: 'Something went wrong on our side. ',
    bold: "Your plan hasn't changed.",
    tail: '',
  },
  stale: {
    icon: 'history',
    tone: 'info',
    title: 'Plan changed meanwhile',
    lead: 'Your plan was updated somewhere else while we worked on this, so ',
    bold: 'nothing was overwritten.',
    tail: ' Try again to use the latest version.',
  },
  offline: {
    icon: 'wifi-off',
    tone: 'info',
    title: 'Not sent',
    lead: "You're offline. ",
    bold: "Your plan hasn't changed.",
    tail: '',
  },
} as const;

/** Something stopped a change. Always says the plan is as it was, and offers a way on. */
export function ProblemCard({ kind, onRetry, onEdit }: ProblemCardProps) {
  const p = PROBLEMS[kind];
  useAnnounce(`${p.title}. ${p.lead}${p.bold}${p.tail}`);
  return (
    <Surface role="alert">
      <Band divider={false} gap={10} style={{ paddingVertical: 16 }}>
        <Head icon={p.icon} tone={p.tone} title={p.title} />
        <Small>
          {p.lead}
          <Strong>{p.bold}</Strong>
          {p.tail}
        </Small>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
          <Button size="sm" variant="secondary" icon="refresh-cw" accessibilityHint="Sends the same message again" onPress={onRetry}>
            Try again
          </Button>
          <Button size="sm" variant="ghost" icon="pencil" accessibilityHint="Puts the message back in the box" onPress={onEdit}>
            Edit message
          </Button>
        </View>
      </Band>
    </Surface>
  );
}

/** A day separator in the thread ("Yesterday", "Wednesday 7 October"). */
export function DayBreak({ label }: { label: string }) {
  const { colors } = useTheme();
  const rule = { flex: 1, height: 1, backgroundColor: colors.borderSubtle };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 }}>
      <View style={rule} />
      <Text variant="caption" tone="secondary" accessibilityRole="header">
        {label}
      </Text>
      <View style={rule} />
    </View>
  );
}
