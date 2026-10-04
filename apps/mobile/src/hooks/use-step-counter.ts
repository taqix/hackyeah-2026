import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { createStepCounter } from '@/features/steps/step-counter';
import { stepSource } from '@/features/steps/step-source';

const counter = createStepCounter(stepSource);

/** Mount once in the root layout. No sensor subscription or background task. */
export function useStepCounterTracking() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const onAppState = (state: string) => {
      clearInterval(timer);
      counter.setActive(state === 'active');
      if (state === 'active') {
        timer = setInterval(() => { void counter.refresh(); }, 60_000);
      }
    };
    const subscription = AppState.addEventListener('change', onAppState);
    onAppState(AppState.currentState);
    return () => {
      clearInterval(timer);
      subscription.remove();
      counter.setActive(false);
    };
  }, []);
}

/** Share today's system total and permission/retry actions across all screens. */
export function useStepCounter() {
  const state = useSyncExternalStore(counter.subscribe, counter.getSnapshot, counter.getSnapshot);
  return {
    ...state,
    source: stepSource.name,
    /** False on the web: steps come from the phone's own counter, so there is nothing to show or ask for. */
    supported: stepSource.name !== 'unsupported',
    refresh: counter.refresh,
    requestPermission: counter.requestPermission,
    openSettings: stepSource.openSettings,
  };
}
