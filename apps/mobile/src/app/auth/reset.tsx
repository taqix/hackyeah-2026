import { useLocalSearchParams } from 'expo-router';

import { redirectParamsFrom, ResetPasswordScreen } from '@/features/auth';

/** The password reset email opens this (`hackyeah2026://auth/reset`, web `/auth/reset`). */
export default function ResetPasswordRoute() {
  const params = useLocalSearchParams();
  return <ResetPasswordScreen params={redirectParamsFrom(params)} />;
}
