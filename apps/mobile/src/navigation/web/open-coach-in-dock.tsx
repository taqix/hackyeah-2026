import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { ChatRouteParams } from '../routes';
import { useCoachDock } from './coach-dock';

/**
 * /coach where the coach has a dock (the desktop web): the request opens the
 * dock, and the address goes back to the page under it, or to Today when the
 * link was opened on its own. One chat on screen, never a page and a dock.
 */
export function OpenCoachInDock() {
  const params = useLocalSearchParams<ChatRouteParams>();
  const router = useRouter();
  const { show } = useCoachDock();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    show(params);
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [params, router, show]);

  return null;
}
