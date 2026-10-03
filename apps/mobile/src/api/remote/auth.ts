import type { ApiClient } from '../client';
import { notImplemented, type RemoteContext } from './context';

/**
 * Supabase Auth (`ctx.deps.auth`): email and password, Google through PKCE
 * (`deps.openAuthSession`, `deps.redirectUrl('auth/callback')`), password
 * reset and the new password, providers from GET {supabaseUrl}/auth/v1/settings
 * (`deps.fetch` with the publishable key), and sign-out, which must also
 * `ctx.data.reset()`.
 */
export function createRemoteAuth(ctx: RemoteContext): ApiClient['auth'] {
  return {
    getSession: () => notImplemented(),
    lookupEmail: () => notImplemented(),
    signInWithEmail: () => notImplemented(),
    signUpWithEmail: () => notImplemented(),
    signInWithGoogle: () => notImplemented(),
    sendPasswordReset: () => notImplemented(),
    updatePassword: () => notImplemented(),
    getProviders: () => notImplemented(),
    signOut: () => notImplemented(),
  };
}
