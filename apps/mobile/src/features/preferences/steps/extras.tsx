import { Text } from '@/components/ui';

import type { StepBodyProps } from './types';

/** 3.4 Good to know. INTERFACE STUB: the onboarding work replaces this body; keep the name and props. */
export function ExtrasStep({ mode }: StepBodyProps) {
  return <Text variant="h1">{mode === 'edit' ? '' : 'Good to know'}</Text>;
}
