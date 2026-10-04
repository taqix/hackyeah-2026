import { usePreferences, useSports } from '@/api/hooks';
import { Text } from '@/components/ui';

import { AnswerRows } from './answer-rows';
import { PanelCard } from './panel';
import { ErrorState, RowsSkeleton } from './pieces';

const TITLE = 'What shapes your plan';

/** You (desktop): the answers, one row per onboarding step, in a card. */
export function AnswersPanel() {
  const preferences = usePreferences();
  const sports = useSports();

  return (
    <PanelCard title={TITLE} caption="Only you change these" gap={8}>
      {preferences.isPending ? (
        <RowsSkeleton count={5} />
      ) : preferences.isError ? (
        <ErrorState title="We couldn't load your answers" onRetry={() => void preferences.refetch()} />
      ) : preferences.data ? (
        <AnswerRows preferences={preferences.data} sports={sports.data} />
      ) : (
        <Text variant="bodySm">No answers saved yet.</Text>
      )}
    </PanelCard>
  );
}
