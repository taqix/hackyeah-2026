import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import { isSignInCancelled } from '@/api/remote/auth';
import type { Account, AuthSession } from '@/api/types';

/** Everything cached except the session and the providers belongs to one user. */
const isUserData = (key: readonly unknown[]) => key[0] !== 'auth';

/** Store a fresh session and refetch anything a previous user left in the cache. */
export function signedIn(queryClient: QueryClient, session: AuthSession) {
  queryClient.setQueryData(queryKeys.session, session);
  void queryClient.resetQueries({ predicate: (q) => isUserData(q.queryKey) });
}

/** After a sign-out: the session is null and nothing cached for the person is kept. */
export function signedOut(queryClient: QueryClient) {
  queryClient.setQueryData(queryKeys.session, null);
  queryClient.removeQueries({ predicate: (q) => isUserData(q.queryKey) });
}

/** The signed-in session, or null. */
export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: () => api.auth.getSession() });
}

/** Welcome (1): whether an account uses this email, to ask for its password (1.1) or a new one (1.2). */
export function useLookupEmail() {
  return useMutation({
    mutationKey: ['auth', 'lookup-email'],
    mutationFn: (email: string) => api.auth.lookupEmail(email),
  });
}

/** 1.1: rejects with `invalid_credentials` on a wrong password (1.3). */
export function useSignInWithEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'sign-in-email'],
    mutationFn: ({ email, password }: { email: string; password: string }) => api.auth.signInWithEmail(email, password),
    onSuccess: (session) => signedIn(queryClient, session),
  });
}

/**
 * 1.2: creates the account with the name to greet the person by; rejects with
 * `weak_password` under 8 characters, `validation` for an empty or too long
 * name, `email_taken`, or `confirmation_required` when the email must be confirmed first.
 */
export function useSignUpWithEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'sign-up-email'],
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      api.auth.signUpWithEmail(email, password, name),
    onSuccess: (session) => signedIn(queryClient, session),
  });
}

/** Continue with Google. Resolves with null when the person closes Google without signing in. */
export function useSignInWithGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'sign-in-google'],
    mutationFn: async (): Promise<AuthSession | null> => {
      try {
        return await api.auth.signInWithGoogle();
      } catch (error) {
        if (isSignInCancelled(error)) return null;
        throw error;
      }
    },
    onSuccess: (session) => {
      if (session) signedIn(queryClient, session);
    },
  });
}

/**
 * Continue as guest (web only): signs in a new anonymous account named Guest,
 * which the gate then sends to onboarding. Rejects with GuestModeUnavailable
 * when the server has guests switched off.
 */
export function useSignInAsGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'sign-in-guest'],
    mutationFn: () => api.auth.signInAsGuest(),
    onSuccess: (session) => signedIn(queryClient, session),
  });
}

/**
 * Save your progress: adds an email and password to the signed-in guest. The
 * person, plan and history stay the same, so only the session and the account
 * are read again. Rejects with confirmation_required (check the inbox),
 * email_taken, weak_password or validation.
 */
export function useUpgradeGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'upgrade-guest'],
    mutationFn: ({ email, password }: { email: string; password: string }) => api.auth.upgradeGuest(email, password),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
      queryClient.setQueryData<Account>(queryKeys.account, (account) =>
        account ? { ...account, user: session.user } : account,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}

/** Forgot password? Sends the reset email. */
export function useSendPasswordReset() {
  return useMutation({
    mutationKey: ['auth', 'password-reset'],
    mutationFn: (email: string) => api.auth.sendPasswordReset(email),
  });
}

/** The new-password screen after a reset link; rejects with weak_password under 8 characters. */
export function useUpdatePassword() {
  return useMutation({
    mutationKey: ['auth', 'update-password'],
    mutationFn: (password: string) => api.auth.updatePassword(password),
  });
}

/** Which sign-in methods are on (Welcome hides Google while it is off). */
export function useAuthProviders() {
  return useQuery({ queryKey: queryKeys.authProviders, queryFn: () => api.auth.getProviders(), staleTime: 5 * 60_000 });
}

/** Sign out: the session becomes null and every other cached query is dropped. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'sign-out'],
    mutationFn: () => api.auth.signOut(),
    onSuccess: () => signedOut(queryClient),
  });
}
