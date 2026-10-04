import { useSports } from '@/api/hooks';
import { Question, Text } from '@/components/ui';
import { Body, Col, H1, Steps } from '@/components/layout';
import { ONBOARDING_ORDER } from '@/features/onboarding/step-screen';
import {
  DiscoveryQuestion,
  isPickable,
  SportSearch,
  SportTags,
  SportTagsError,
  SportTagsLoading,
} from '@/features/preferences/activities';
import { toggleValue } from '@/state/onboarding-draft';

import type { StepBodyProps } from './types';

const QUESTION = 'What would you like to try?';

/** 3.2 Activities: activity_interests (catalog sport IDs) and discovery_preference. */
export function ActivitiesStep({ draft, update, mode }: StepBodyProps) {
  const sports = useSports();
  const picked = draft.activity_interests;
  const toggle = (id: string) => update({ activity_interests: toggleValue(picked, id) });

  return (
    <Col gap={24}>
      {mode === 'onboarding' ? (
        <>
          <Steps step={ONBOARDING_ORDER.indexOf('activities') + 1} total={ONBOARDING_ORDER.length} />
          <Col gap={8}>
            <H1>{QUESTION}</H1>
            <Body>{"Pick any that sound good — or none, and we'll help you explore."}</Body>
          </Col>
        </>
      ) : null}
      <Col gap={12}>
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
