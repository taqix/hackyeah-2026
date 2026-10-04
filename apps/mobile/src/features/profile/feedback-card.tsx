import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFeedbackOverview, useSports } from '@/api/hooks';
import type { ChooseAgain } from '@/api/types';
import { Icon, type IconName, Text, TextLink } from '@/components/ui';
import { sportIcon, sportName } from '@/lib/sport-visuals';
import { useTheme } from '@/theme';

import { PanelCard } from './panel';
import { ErrorState, RowsSkeleton } from './pieces';

const TITLE = 'Your feedback';

const GROUPS: { opinion: ChooseAgain; title: string }[] = [
  { opinion: 'yes', title: "You'd choose again" },
  { opinion: 'maybe', title: 'Maybe' },
  { opinion: 'no', title: 'Not for now' },
];

type ChipTone = 'accent' | 'quiet' | 'off';

/** You (desktop): each answer to "Would you choose this again?" at a glance, and what's switched off. */
export function FeedbackCard() {
  const router = useRouter();
  const feedback = useFeedbackOverview();
  const sports = useSports();

  const manage = (
    <TextLink onPress={() => router.push('/profile/feedback')} accessibilityHint="Opens your feedback to change it">
      Manage
    </TextLink>
  );

  if (feedback.isPending) {
    return (
      <PanelCard title={TITLE}>
        <RowsSkeleton count={2} disc={28} />
      </PanelCard>
    );
  }
  if (feedback.isError) {
    return (
      <PanelCard title={TITLE}>
        <ErrorState title="We couldn't load your feedback" onRetry={() => void feedback.refetch()} />
      </PanelCard>
    );
  }

  const { opinions, excluded_sport_ids: off } = feedback.data;
  const groups = GROUPS.map((g) => ({ ...g, items: opinions.filter((o) => o.opinion === g.opinion) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <PanelCard title={TITLE} caption="Would you choose this again?" action={manage} gap={16}>
      {groups.length === 0 ? (
        <Text variant="bodySm">No answers yet. After your next session, what you&apos;d choose again shows up here.</Text>
      ) : (
        groups.map(({ opinion, title, items }) => (
          <ChipGroup key={opinion} title={title}>
            {items.map((item) => (
              <Chip
                key={item.activity_key}
                icon={sportIcon(item.sport_id)}
                label={item.title}
                tone={opinion === 'yes' ? 'accent' : 'quiet'}
              />
            ))}
          </ChipGroup>
        ))
      )}
      {off.length ? (
        <ChipGroup title="Switched off">
          {off.map((id) => (
            <Chip key={id} icon={sportIcon(id)} label={sportName(sports.data, id)} tone="off" />
          ))}
        </ChipGroup>
      ) : null}
    </PanelCard>
  );
}

function ChipGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="label" tone="secondary">
        {title}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

/** A read-only pill: an activity and its icon. */
function Chip({ icon, label, tone }: { icon: IconName; label: string; tone: ChipTone }) {
  const { colors } = useTheme();
  const look = {
    accent: { bg: colors.accentSoft, fg: colors.accentText, border: colors.accentSoft },
    quiet: { bg: colors.surfaceSunken, fg: colors.textPrimary, border: colors.surfaceSunken },
    off: { bg: 'transparent', fg: colors.textSecondary, border: colors.borderStrong },
  }[tone];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: look.bg, borderColor: look.border, borderStyle: tone === 'off' ? 'dashed' : 'solid' },
      ]}>
      <Icon name={icon} size={14} color={look.fg} />
      <Text variant="label" numberOfLines={1} style={{ color: look.fg, flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    maxWidth: '100%',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
});
