import { Text } from '@/components/ui';

import type { StepBodyProps } from './types';

/** 3.2 Activities. INTERFACE STUB: the onboarding work replaces this body; keep the name and props. */
export function ActivitiesStep({ mode }: StepBodyProps) {
  return <Text variant="h1">{mode === 'edit' ? '' : 'Activities'}</Text>;
}
