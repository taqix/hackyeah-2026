import { Redirect, useLocalSearchParams } from 'expo-router';

import { PasswordScreen, parseAuthMode } from '@/features/auth';

export default function PasswordRoute() {
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  if (!email) return <Redirect href="/welcome" />;
  const mode = parseAuthMode(params.mode);
  // Keyed so "Sign in instead" (same route, another mode) starts a fresh form.
  return <PasswordScreen key={`${mode}:${email}`} email={email} mode={mode} />;
}
