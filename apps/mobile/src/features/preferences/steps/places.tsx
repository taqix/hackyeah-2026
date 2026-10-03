import { Text } from '@/components/ui';

import type { StepBodyProps } from './types';

/** 3.3 Places. INTERFACE STUB: the onboarding work replaces this body; keep the name and props. */
export function PlacesStep({ mode }: StepBodyProps) {
  return <Text variant="h1">{mode === 'edit' ? '' : 'Places'}</Text>;
}
