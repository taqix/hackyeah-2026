import { useSports } from '@/api/hooks';
import { Question, Text } from '@/components/ui';
import { Col, useLayout } from '@/components/layout';
import {
  DiscoveryQuestion,
  isPickable,
  SportSearch,
  SportTags,
  SportTagsError,
  SportTagsLoading,
} from '@/features/preferences/activities';
import { toggleValue } from '@/state/onboarding-draft';

import { OnboardingHeading } from './heading';
import type { StepBodyProps } from './types';

const QUESTION = 'What would you like to try?';

/** 3.2 Activities: activity_interests (catalog sport IDs) and discovery_preference. */
export function ActivitiesStep({ draft, update, mode }: StepBodyProps) {
  const { isDesktop } = useLayout();
  const sports = useSports();
  const picked = draft.activity_interests;
  const toggle = (id: string) => update({ activity_interests: toggleValue(picked, id) });

  return (
    <Col gap={isDesktop ? 32 : 24}>
      {mode === 'onboarding' ? (
        <OnboardingHeading
          section="activities"
          title={QUESTION}
          body={"Pick any that sound good — or none, and we'll help you explore."}
        />
      ) : null}
      <Col gap={isDesktop ? 16 : 12}>
        {mode === 'edit' ? <Question>{QUESTION}</Question> : null}
        {sports.data && !sports.data.some(isPickable) ? (
          // An empty catalog (nothing seeded yet): explain, and let the person go on with explore.
          <Text variant="bodySm">
            {"We can't plan any sport yet. You can still continue, and we'll help you explore once sports are ready."}
          </Text>
        ) : sports.data ? (
          <>
            <SportTags sports={sports.data} selected={picked} onToggle={toggle} />
            <SportSearch
              sports={sports.data}
              selected={picked}
              onAdd={(id) => update({ activity_interests: [...picked, id] })}
            />
          </>
        ) : sports.isError ? (
          <SportTagsError onRetry={() => void sports.refetch()} retrying={sports.isFetching} />
        ) : (
          <SportTagsLoading />
        )}
      </Col>
      <DiscoveryQuestion draft={draft} update={update} />
    </Col>
  );
}
