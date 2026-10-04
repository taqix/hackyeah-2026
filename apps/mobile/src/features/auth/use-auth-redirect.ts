import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isMockMode } from '@/api/config';
import { queryKeys } from '@/api/query-keys';
import { type AuthRedirectParams, completeAuthRedirect, isSignInCancelled } from '@/api/remote/auth';
import { supabaseAuth } from '@/api/remote/default';

const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

type SearchParams = Record<string, string | string[] | undefined>;

const single = (value: string | string[] | undefined) => (typeof value === 'string' && value ? value : null);

/** The code or error an Auth redirect brought, from the route's search params. */
export function redirectParamsFrom(params: SearchParams): AuthRedirectParams {
  return {
    code: single(params.code),
    error: single(params.error_code) ?? single(params.error),
    errorDescription: single(params.error_description),
  };
}

export type AuthRedirectState =
  /** Mock mode, or switched off: there is no redirect to finish. */
  | { status: 'skipped' }
  | { status: 'working' }
  | { status: 'done' }
  /** The person declined on Google's page. */
  | { status: 'cancelled' }
  | { status: 'failed'; error: unknown; retry: () => void };

/**
 * Finishes an Auth redirect on the screen it opened (/auth/callback,
 * /auth/reset): trades its one-time code for a session. The parameters are read
 * once, because supabase-js may strip the code from the web URL while loading.
 */
export function useAuthRedirect(params: AuthRedirectParams, { enabled = true } = {}): AuthRedirectState {
  const queryClient = useQueryClient();
  const [initial] = useState(params);
  const [run] = useState(enabled && !isMockMode);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AuthRedirectState>(run ? { status: 'working' } : { status: 'skipped' });

  useEffect(() => {
    if (!run) return;
    let live = true;
    completeAuthRedirect(supabaseAuth, initial, platform).then(
      (session) => {
        if (!live) return;
        queryClient.setQueryData(queryKeys.session, session);
        setState({ status: 'done' });
      },
      (error: unknown) => {
        if (!live) return;
        if (isSignInCancelled(error)) setState({ status: 'cancelled' });
        else
          setState({
            status: 'failed',
            error,
            retry: () => {
              setState({ status: 'working' });
              setAttempt((n) => n + 1);
            },
          });
      },
    );
    return () => {
      live = false;
    };
  }, [run, initial, attempt, queryClient]);

  return state;
}
