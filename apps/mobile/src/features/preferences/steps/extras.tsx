import { CheckList, Question } from '@/components/ui';
import { Body, Col, Columns, useLayout } from '@/components/layout';
import { PREF_OPTIONS } from '@/lib/preference-options';
import { toggleValue } from '@/state/onboarding-draft';

import { OnboardingHeading } from './heading';
import type { StepBodyProps } from './types';

const AVOID_QUESTION = 'Is there anything you would rather avoid?';
const OBSTACLE_QUESTION = 'What usually makes starting difficult?';
const INTRO = 'Both questions are optional. Tick any that apply.';

/**
 * 3.4 Good to know: two checkbox lists (side by side on a wide desktop).
 * Nothing ticked is a full answer and saves [], so there is no "Nothing to
 * avoid" option to keep in sync.
 */
export function ExtrasStep({ draft, update, mode }: StepBodyProps) {
  const { isDesktop } = useLayout();
  const avoid = (
    <Col gap={4}>
      <Question>{AVOID_QUESTION}</Question>
      <CheckList
        label={AVOID_QUESTION}
        options={PREF_OPTIONS.avoidances}
        values={draft.avoidances}
        onToggle={(value) => update({ avoidances: toggleValue(draft.avoidances, value) })}
      />
    </Col>
  );
  const obstacles = (
    <Col gap={4}>
      <Question>{OBSTACLE_QUESTION}</Question>
      <CheckList
        label={OBSTACLE_QUESTION}
        options={PREF_OPTIONS.starting_obstacles}
        values={draft.starting_obstacles}
        onToggle={(value) => update({ starting_obstacles: toggleValue(draft.starting_obstacles, value) })}
      />
    </Col>
  );

  return (
    <>
      {mode === 'onboarding' ? <OnboardingHeading section="extras" title="Good to know" body={INTRO} /> : <Body>{INTRO}</Body>}
      {isDesktop ? (
        <Columns from="wide" gap={32}>
          {avoid}
          {obstacles}
        </Columns>
      ) : (
        <>
          {avoid}
          {obstacles}
        </>
      )}
    </>
  );
}
