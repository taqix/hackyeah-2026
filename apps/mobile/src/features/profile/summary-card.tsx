import { useRouter } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';

import { useAssistantSummary } from '@/api/hooks';
import { Skeleton, SuggestionCard } from '@/components/ui';
import { useTheme } from '@/theme';

import { cardKicker } from './labels';

type SummaryCardProps = {
  today: Date;
  /** Desktop: the taller hero beside the page's other cards. */
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

/**
 * The summary card. While it rebuilds it keeps the old text marked as updating;
 * when it can't be written (or fails to load) the card hides and the answers stay.
 */
export function SummaryCard({ today, size = 'md', style }: SummaryCardProps) {
  const router = useRouter();
  const { radius } = useTheme();
  const summary = useAssistantSummary();

  if (summary.isPending) return <Skeleton height={size === 'lg' ? 300 : 220} radius={radius.xl} />;
  const data = summary.data;
  if (!data || data.status === 'unavailable' || !data.title) return null;

  return (
    <SuggestionCard
      tone="dawn"
      kicker={cardKicker(data, today)}
      title={data.title}
      body={data.headline}
      actionLabel="See why"
      onAction={() => router.push('/profile/summary')}
      size={size}
      style={style}
    />
  );
}
