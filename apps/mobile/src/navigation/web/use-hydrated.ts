import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False on the server and while React hydrates the static page, true after.
 * The static export renders at no width (the phone layout); UI that depends on
 * the window waits for this so the first client render matches the HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
