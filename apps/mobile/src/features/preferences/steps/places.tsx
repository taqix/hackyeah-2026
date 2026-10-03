import { ChipGroup, Question, Tag } from '@/components/ui';
import { Body, Col, H1, Steps } from '@/components/layout';
import { ONBOARDING_ORDER } from '@/features/onboarding/step-screen';
import { NO_EQUIPMENT_LABEL, PREF_OPTIONS } from '@/lib/preference-options';
import { toggleValue } from '@/state/onboarding-draft';

import type { StepBodyProps } from './types';

const PLACES_QUESTION = 'Where could you move?';
const EQUIPMENT_QUESTION = 'What do you have available?';

/**
 * 3.3 Places: at least one location (the screen keeps Continue or Save disabled
 * without one), and equipment. No equipment saves [] and clears the other chips;
 * equipment is only what the person picks, so a gym adds none.
 */
export function PlacesStep({ draft, update, mode }: StepBodyProps) {
  const equipment = draft.available_equipment;
  return (
    <>
      {mode === 'onboarding' ? (
        <>
          <Steps step={ONBOARDING_ORDER.indexOf('places') + 1} total={ONBOARDING_ORDER.length} />
          <Col gap={8}>
            <H1>{PLACES_QUESTION}</H1>
            <Body>Pick at least one.</Body>
          </Col>
        </>
      ) : (
        <Question hint="Pick at least one.">{PLACES_QUESTION}</Question>
      )}
      <ChipGroup label={PLACES_QUESTION}>
        {PREF_OPTIONS.available_locations.map((option) => (
          <Tag
            key={option.value}
            label={option.label}
            icon={option.icon}
            selected={draft.available_locations.includes(option.value)}
            onPress={() => update({ available_locations: toggleValue(draft.available_locations, option.value) })}
          />
        ))}
      </ChipGroup>
      <Col gap={12}>
        <Question hint="We only plan with what you pick, even at a gym.">{EQUIPMENT_QUESTION}</Question>
        <ChipGroup label={EQUIPMENT_QUESTION}>
          {PREF_OPTIONS.available_equipment.map((option) => (
            <Tag
              key={option.value}
              label={option.label}
              selected={equipment.includes(option.value)}
              onPress={() => update({ available_equipment: toggleValue(equipment, option.value) })}
            />
          ))}
          <Tag
            label={NO_EQUIPMENT_LABEL}
            selected={equipment.length === 0}
            onPress={() => update({ available_equipment: [] })}
          />
        </ChipGroup>
      </Col>
    </>
  );
}
