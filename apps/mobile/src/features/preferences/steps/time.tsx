import { Text } from '@/components/ui';

import type { StepBodyProps } from './types';

/** 3.1 Time. INTERFACE STUB: the onboarding work replaces this body; keep the name and props. */
export function TimeStep({ mode }: StepBodyProps) {
  return <Text variant="h1">{mode === 'edit' ? '' : 'Time'}</Text>;
}
