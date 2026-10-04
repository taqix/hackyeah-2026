import { useSyncExternalStore } from 'react';

/**
 * Whether Supabase reported PASSWORD_RECOVERY: the person opened a reset link
 * and may set a new password. Set by AuthSessionSync, cleared once the new
 * password is saved. Memory only; a new link sets it again.
 */
let pending = false;
const listeners = new Set<() => void>();

export function setRecoveryPending(value: boolean) {
  if (pending === value) return;
  pending = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRecoveryPending(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => false,
  );
}
