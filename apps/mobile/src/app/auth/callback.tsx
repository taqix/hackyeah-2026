import { useLocalSearchParams } from 'expo-router';

import { AuthCallbackScreen, redirectParamsFrom } from '@/features/auth';

/** Google and the email confirmation link return here (`hackyeah2026://auth/callback`, web `/auth/callback`). */
export default function AuthCallbackRoute() {
  const params = useLocalSearchParams();
  return <AuthCallbackScreen params={redirectParamsFrom(params)} />;
}
