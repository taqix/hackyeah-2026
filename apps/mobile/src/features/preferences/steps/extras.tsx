import { CheckList, Question } from '@/components/ui';
import { Body, Col, H1, Steps } from '@/components/layout';
import { ONBOARDING_ORDER } from '@/features/onboarding/step-screen';
import { PREF_OPTIONS } from '@/lib/preference-options';
import { toggleValue } from '@/state/onboarding-draft';

import type { StepBodyProps } from './types';

const AVOID_QUESTION = 'Is there anything you would rather avoid?';
const OBSTACLE_QUESTION = 'What usually makes starting difficult?';

/**
 * 3.4 Good to know: two checkbox lists. Nothing ticked is a full answer and saves
 * [], so there is no "Nothing to avoid" option to keep in sync.
 */
export function ExtrasStep({ draft, update, mode }: StepBodyProps) {
  return (
    <>
      {mode === 'onboarding' ? (
        <>
          <Steps step={ONBOARDING_ORDER.indexOf('extras') + 1} total={ONBOARDING_ORDER.length} />
          <Col gap={8}>
            <H1>Good to know</H1>
            <Body>Both questions are optional. Tick any that apply.</Body>
          </Col>
        </>
      ) : (
        <Body>Both questions are optional. Tick any that apply.</Body>
      )}
      <Col gap={4}>
        <Question>{AVOID_QUESTION}</Question>
        <CheckList
          label={AVOID_QUESTION}
          options={PREF_OPTIONS.avoidances}
          values={draft.avoidances}
          onToggle={(value) => update({ avoidances: toggleValue(draft.avoidances, value) })}
        />
      </Col>
      <Col gap={4}>
        <Question>{OBSTACLE_QUESTION}</Question>
        <CheckList
          label={OBSTACLE_QUESTION}
          options={PREF_OPTIONS.starting_obstacles}
          values={draft.starting_obstacles}
          onToggle={(value) => update({ starting_obstacles: toggleValue(draft.starting_obstacles, value) })}
        />
      </Col>
    </>
  );
}
