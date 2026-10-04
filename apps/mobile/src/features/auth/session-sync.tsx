import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { isMockMode } from '@/api/config';
import { signedIn, signedOut } from '@/api/hooks/auth';
import { queryKeys } from '@/api/query-keys';
import { authLinkKind, authRedirectParams, exchangeAuthCode, keepKnownName, toAuthSession } from '@/api/remote/auth';
import { getRemoteRuntime, supabaseAuth } from '@/api/remote/default';
import type { AuthSession } from '@/api/types';
import { debugLog, debugWarn, describeError, errorLabel, maskEmail, shortId } from '@/lib/debug-log';

import { setRecoveryPending } from './recovery';

const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

/** Runs Auth housekeeping whose failure has nowhere to be shown (debug builds log it). */
function quietly(run: () => Promise<unknown>, label = 'auth housekeeping') {
  void Promise.resolve()
    .then(run)
    .catch((error: unknown) => debugWarn('auth', `✕ ${label} ${errorLabel(error)}`, () => describeError(error)));
}

function startAuthSync(queryClient: QueryClient): () => void {
  const flushed = new Set<string>();

  // supabase-js holds its lock while it notifies: nothing here may wait on Auth.
  const { data } = supabaseAuth.onAuthStateChange((event, session) => {
    debugLog('auth', `event ${event}`, () =>
      session
        ? {
            user: shortId(session.user.id),
            email: maskEmail(session.user.email),
            provider: session.user.app_metadata.provider ?? 'email',
          }
        : { signed_in: false },
    );
    const previous = queryClient.getQueryData<AuthSession | null>(queryKeys.session);
    if (!session) {
      flushed.clear();
      getRemoteRuntime().data.reset();
      quietly(() => getRemoteRuntime().googleCalendar.forgetPending(), 'google calendar pending connect');
      if (previous) signedOut(queryClient);
      else queryClient.setQueryData(queryKeys.session, null);
      return;
    }

    const next = keepKnownName(toAuthSession(session), previous);
    // Another account took over: drop what the previous one left in the cache.
    if (previous && previous.user.id !== next.user.id) {
      debugLog('auth', 'another account signed in: resetting cached user data');
      signedIn(queryClient, next);
    } else queryClient.setQueryData(queryKeys.session, next);
    if (event === 'PASSWORD_RECOVERY') setRecoveryPending(true);

    // Right after a Google sign-in the session carries Google's tokens, once. If
    // Data and privacy started a Google Calendar connect, keep them (web lands
    // here after the page reloads). After the lock: capture may restore a session.
    if (session.provider_token) {
      setTimeout(() => quietly(() => getRemoteRuntime().googleCalendar.capture(session), 'google calendar capture'), 0);
    }

    // Logs left as drafts by an earlier run are saved once per signed-in start.
    if (!flushed.has(next.user.id)) {
      flushed.add(next.user.id);
      setTimeout(
        () =>
          quietly(async () => {
            const runtime = getRemoteRuntime();
            if ((await runtime.drafts.list()).length === 0) return;
            await runtime.flushDrafts();
            void queryClient.invalidateQueries({ queryKey: queryKeys.planAll });
            void queryClient.invalidateQueries({ queryKey: queryKeys.logsAll });
          }, 'draft flush'),
        0,
      );
    }
  });
  const cleanups = [() => data.subscription.unsubscribe()];

  if (platform !== 'web') {
    // React Native has no page visibility: refresh the token only in the foreground.
    const refresh = (state: AppStateStatus) => {
      debugLog('auth', `token auto-refresh ${state === 'active' ? 'on' : 'off'} (app ${state})`);
      quietly(
        () => (state === 'active' ? supabaseAuth.startAutoRefresh() : supabaseAuth.stopAutoRefresh()),
        'token auto-refresh',
      );
    };
    refresh(AppState.currentState);
    const appState = AppState.addEventListener('change', refresh);
    cleanups.push(() => appState.remove());

    // OAuth, email confirmation and recovery links carry a one-time code. The
    // route they open trades it too; the exchange runs once per code.
    const handleLink = (url: string | null) => {
      const kind = url ? authLinkKind(url) : null;
      if (!url || !kind) return;
      // The kind only: the link's one-time code is never logged.
      debugLog('auth', `deep link auth/${kind}`);
      const { code } = authRedirectParams(url);
      if (code) {
        quietly(async () => {
          const session = await exchangeAuthCode(supabaseAuth, code, platform);
          // A Google Calendar connect whose sheet reported a dismiss (Android) finishes here.
          await getRemoteRuntime().googleCalendar.capture(session);
        }, `deep link auth/${kind} code exchange`);
      }
    };
    quietly(() => Linking.getInitialURL().then(handleLink));
    const links = Linking.addEventListener('url', ({ url }) => handleLink(url));
    cleanups.push(() => links.remove());
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}

/**
 * Keeps the app in step with Supabase Auth, mounted once inside
 * QueryClientProvider: auth state changes update the cached session (and a
 * sign-out drops user data and resets the remote cache), the token refresh
 * runs only while the app is in the foreground, auth deep links (OAuth,
 * confirmation, recovery) are exchanged for a session, and saved drafts are
 * flushed at a signed-in start. Renders nothing; does nothing in mock mode.
 */
export function AuthSessionSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isMockMode) return;
    return startAuthSync(queryClient);
  }, [queryClient]);

  return null;
}
