import type { ComponentType } from 'react';

import type { PreferenceSection } from '@/api/types';

import { ActivitiesStep } from './activities';
import { ExtrasStep } from './extras';
import { PlacesStep } from './places';
import { StartingStep } from './starting';
import { TimeStep } from './time';
import type { StepBodyProps } from './types';

export type { StepBodyProps } from './types';
export { ActivitiesStep, ExtrasStep, PlacesStep, StartingStep, TimeStep };

/** The step body for each section, for Profile › Edit (9.4). */
export const STEP_BODIES: Record<PreferenceSection, ComponentType<StepBodyProps>> = {
  starting: StartingStep,
  time: TimeStep,
  activities: ActivitiesStep,
  places: PlacesStep,
  extras: ExtrasStep,
};
