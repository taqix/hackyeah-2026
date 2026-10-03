import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useBuildPlan, useSavePreferences } from '@/api/hooks';
import { now } from '@/lib/clock';
import { startOfWeek } from '@/lib/dates';
import { draftToPreferences, getDraft, resetDraft } from '@/state/onboarding-draft';

/**
 * Review's Build plan: save the answers, start planning this week (the client
 * reads free calendar time itself, or uses the preferred window without
 * access), then open Today, which shows the building state. A failure keeps
 * the answers here for Try again.
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
      await savePreferences.mutateAsync(draftToPreferences(getDraft()));
      await buildPlan.mutateAsync({ week_start: startOfWeek(now()) });
      built.current = true;
      router.replace('/(tabs)');
    } catch {
      setStatus('failed');
    }
  };

  return { start, working: status === 'working', failed: status === 'failed' };
}
