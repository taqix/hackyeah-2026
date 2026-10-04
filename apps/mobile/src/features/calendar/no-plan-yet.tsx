import type { PlanStatus } from '@/api/types';

import { EmptyState } from './states';

/** The Calendar before the first plan exists: on its way, failed, or not asked for yet. */
export function NoPlanYet({ status, onToday }: { status: PlanStatus; onToday: () => void }) {
  const action = { label: 'Go to Today', onPress: onToday };
  if (status === 'building') {
    return (
      <EmptyState
        icon="calendar-clock"
        title="Your first plan is on its way."
        body="Its sessions show here once it's ready. This takes about a minute."
        action={action}
      />
    );
  }
  if (status === 'failed') {
    return (
      <EmptyState
        icon="calendar-x"
        title="No sessions yet."
        body="Your first plan isn't built yet. Today shows why, and lets you try again."
        action={action}
      />
    );
  }
  return (
    <EmptyState
      icon="calendar-days"
      title="No sessions yet."
      body="Your sessions show here once your first plan is ready. Plans go one week ahead."
      action={action}
    />
  );
}
