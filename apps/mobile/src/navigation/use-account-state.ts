import { usePreferences, useSession } from '@/api/hooks';

export type AccountState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'signed-out' }
  | { status: 'needs-onboarding' }
  | { status: 'ready' };

/**
 * Where the person stands: signed in, and whether onboarding saved their answers.
 * Preferences are read only with a session. `checkPreferences: false` skips them.
 */
export function useAccountState({ checkPreferences = true } = {}): AccountState {
  const session = useSession();
  const signedIn = Boolean(session.data);
  const preferences = usePreferences({ enabled: signedIn && checkPreferences });

  if (session.isPending) return { status: 'loading' };
  if (session.isError) return { status: 'error', retry: () => void session.refetch() };
  if (!session.data) return { status: 'signed-out' };
  if (!checkPreferences) return { status: 'ready' };
  if (preferences.isPending) return { status: 'loading' };
  if (preferences.isError) return { status: 'error', retry: () => void preferences.refetch() };
  if (!preferences.data) return { status: 'needs-onboarding' };
  return { status: 'ready' };
}
