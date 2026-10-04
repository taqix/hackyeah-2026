import { Question, RadioCard, RadioGroup } from '@/components/ui';
import { Body, Col, H1, Steps } from '@/components/layout';
import { ONBOARDING_ORDER } from '@/features/onboarding/step-screen';
import { PREF_OPTIONS } from '@/lib/preference-options';

import type { StepBodyProps } from './types';

const QUESTION = 'How does starting feel?';

/** 2 Starting point: starting_comfort as radio cards with a line under each. */
export function StartingStep({ draft, update, mode }: StepBodyProps) {
  const options = (
    <RadioGroup label={QUESTION}>
      {PREF_OPTIONS.starting_comfort.map((o) => (
        <RadioCard
          key={o.value}
          label={o.label}
          description={o.description}
          checked={draft.starting_comfort === o.value}
          onPress={() => update({ starting_comfort: o.value })}
        />
      ))}
    </RadioGroup>
  );

  if (mode === 'edit') {
    return (
      <Col gap={12}>
        <Question>{QUESTION}</Question>
        {options}
      </Col>
    );
  }

  return (
    <Col gap={24}>
      <Steps step={ONBOARDING_ORDER.indexOf('starting') + 1} total={ONBOARDING_ORDER.length} />
      <Col gap={8}>
        <H1>{QUESTION}</H1>
        <Body>No wrong answers. This sets how gentle your first week is.</Body>
      </Col>
      {options}
    </Col>
  );
}
