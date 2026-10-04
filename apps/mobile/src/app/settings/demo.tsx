import { Redirect } from 'expo-router';

import { isMockMode } from '@/api/config';
import { DemoScreen } from '@/features/demo/demo-screen';

/** Demo controls drive the mock backend, so they exist only in mock mode. */
export default function DemoRoute() {
  if (!isMockMode) return <Redirect href="/settings" />;
  return <DemoScreen />;
}
