import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useBuildPlan, useSavePreferences } from '@/api/hooks';
import { now } from '@/lib/clock';
import { draftToPreferences, getDraft, resetDraft } from '@/state/onboarding-draft';

import { freeSlotsForPlan } from './calendar-access';

/**
 * Review's Build plan: read free calendar time for the coming week (null without
 * access), save the answers, start generation, then open Today, which shows the
 * building state. A failure keeps the answers here for Try again.
 */
export function useBuildFirstPlan() {
  const router = useRouter();
  const savePreferences = useSavePreferences();
  const buildPlan = useBuildPlan();
  const [status, setStatus] = useState<'idle' | 'working' | 'failed'>('idle');
  const built = useRef(false);

  // Clear the draft once Review has left the screen, so a later sign-up starts blank.
  useEffect(
    () => () => {
      if (built.current) resetDraft();
    },
    [],
  );

  const start = async () => {
    setStatus('working');
    try {
      const available_slots = await freeSlotsForPlan(now());
      await savePreferences.mutateAsync(draftToPreferences(getDraft()));
      await buildPlan.mutateAsync({ available_slots });
      built.current = true;
      router.replace('/(tabs)');
    } catch {
      setStatus('failed');
    }
  };

  return { start, working: status === 'working', failed: status === 'failed' };
}
