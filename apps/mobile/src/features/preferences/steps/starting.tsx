import { Text } from '@/components/ui';

import type { StepBodyProps } from './types';

/** 2 Starting point. INTERFACE STUB: the onboarding work replaces this body; keep the name and props. */
export function StartingStep({ mode }: StepBodyProps) {
  return <Text variant="h1">{mode === 'edit' ? '' : 'Starting point'}</Text>;
}
