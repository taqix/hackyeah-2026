import { ChipGroup, Question, Tag } from '@/components/ui';
import { Col, useLayout } from '@/components/layout';
import { ChoiceGrid, OptionCard } from '@/features/preferences/choices';
import { NO_EQUIPMENT_LABEL, PREF_OPTIONS } from '@/lib/preference-options';
import { toggleValue } from '@/state/onboarding-draft';

import { OnboardingHeading } from './heading';
import type { StepBodyProps } from './types';

const PLACES_QUESTION = 'Where could you move?';
const EQUIPMENT_QUESTION = 'What do you have available?';

/**
 * 3.3 Places: at least one location (the screen keeps Continue or Save disabled
 * without one), and equipment. No equipment saves [] and clears the other chips;
 * equipment is only what the person picks, so a gym adds none. The desktop web
 * shows the places as cards in a row.
 */
export function PlacesStep({ draft, update, mode }: StepBodyProps) {
  const { isDesktop } = useLayout();
  const equipment = draft.available_equipment;
  const togglePlace = (value: (typeof draft.available_locations)[number]) =>
    update({ available_locations: toggleValue(draft.available_locations, value) });

  return (
    <>
      {mode === 'onboarding' ? (
        <OnboardingHeading section="places" title={PLACES_QUESTION} body="Pick at least one." />
      ) : (
        <Question hint="Pick at least one.">{PLACES_QUESTION}</Question>
      )}
      {isDesktop ? (
        <ChoiceGrid label={PLACES_QUESTION} kind="checkbox" minItemWidth={128}>
          {PREF_OPTIONS.available_locations.map((option) => (
            <OptionCard
              key={option.value}
              kind="checkbox"
              layout="stacked"
              icon={option.icon}
              label={option.label}
              selected={draft.available_locations.includes(option.value)}
              onPress={() => togglePlace(option.value)}
            />
          ))}
        </ChoiceGrid>
      ) : (
        <ChipGroup label={PLACES_QUESTION}>
          {PREF_OPTIONS.available_locations.map((option) => (
            <Tag
              key={option.value}
              label={option.label}
              icon={option.icon}
              selected={draft.available_locations.includes(option.value)}
              onPress={() => togglePlace(option.value)}
            />
          ))}
        </ChipGroup>
      )}
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
