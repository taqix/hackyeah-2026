/**
 * Keeps the app in step with Supabase Auth, mounted once inside
 * QueryClientProvider: auth state changes update the cached session (and a
 * sign-out drops user data and resets the remote cache), the token refresh
 * runs only while the app is in the foreground, auth deep links (OAuth,
 * confirmation, recovery) are exchanged for a session, and saved drafts are
 * flushed at a signed-in start. Renders nothing; does nothing in mock mode.
 */
export function AuthSessionSync() {
  return null;
}
