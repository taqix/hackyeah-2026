import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useBuildPlan, useSavePreferences } from '@/api/hooks';
import { isApiError } from '@/api/types';
import { now } from '@/lib/clock';
import { startOfWeek } from '@/lib/dates';
import { newRequestId } from '@/lib/ids';
import { draftToPreferences, getDraft, resetDraft } from '@/state/onboarding-draft';

/** The connection failed, so the server may or may not have the request: worth trying again here. */
const isTransport = (error: unknown) => isApiError(error, 'offline') || isApiError(error, 'timeout');

/**
 * Review's Build plan: save the answers, start planning this week (the client
 * reads free calendar time itself, or uses the preferred window without
 * access), then open Today, which shows the building state. If the answers
 * don't save or the connection drops, Review keeps them for Try again, which
 * resends the same plan request. Any other failure still opens Today: the
 * answers are saved, and Today shows the failed state with its own Try again.
 */
export function useBuildFirstPlan() {
  const router = useRouter();
  const savePreferences = useSavePreferences();
  const buildPlan = useBuildPlan();
  const [status, setStatus] = useState<'idle' | 'working' | 'failed'>('idle');
  const built = useRef(false);
  // One plan request per Build plan; a retry after a dropped connection reuses it.
  const requestId = useRef<string | null>(null);

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
    } catch {
      setStatus('failed');
      return;
    }
    requestId.current ??= newRequestId();
    try {
      await buildPlan.mutateAsync({ week_start: startOfWeek(now()), request_id: requestId.current });
    } catch (error) {
      if (isTransport(error) || isApiError(error, 'unauthorized')) {
        setStatus('failed');
        return;
      }
    }
    built.current = true;
    router.replace('/(tabs)');
  };

  return { start, working: status === 'working', failed: status === 'failed' };
}
