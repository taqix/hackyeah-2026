import { Question, RadioCard, RadioGroup } from '@/components/ui';
import { Col, useLayout } from '@/components/layout';
import { ChoiceGrid, COMFORT_ICONS, OptionCard } from '@/features/preferences/choices';
import { PREF_OPTIONS } from '@/lib/preference-options';

import { OnboardingHeading } from './heading';
import type { StepBodyProps } from './types';

const QUESTION = 'How does starting feel?';

/** 2 Starting point: starting_comfort as radio cards with a line under each (cards side by side on desktop). */
export function StartingStep({ draft, update, mode }: StepBodyProps) {
  const { isDesktop } = useLayout();
  const options = isDesktop ? (
    <ChoiceGrid label={QUESTION} kind="radio" minItemWidth={176}>
      {PREF_OPTIONS.starting_comfort.map((o) => (
        <OptionCard
          key={o.value}
          kind="radio"
          layout="stacked"
          icon={COMFORT_ICONS[o.value]}
          label={o.label}
          description={o.description}
          selected={draft.starting_comfort === o.value}
          onPress={() => update({ starting_comfort: o.value })}
        />
      ))}
    </ChoiceGrid>
  ) : (
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
      <Col gap={isDesktop ? 16 : 12}>
        <Question>{QUESTION}</Question>
        {options}
      </Col>
    );
  }

  return (
    <Col gap={isDesktop ? 32 : 24}>
      <OnboardingHeading
        section="starting"
        title={QUESTION}
        body="No wrong answers. This sets how gentle your first week is."
      />
      {options}
    </Col>
  );
}
