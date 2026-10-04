import { useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { debugLog, shortenIds } from '@/lib/debug-log';

/**
 * Debug builds: one line per route change, `[movo:nav] → /session/1a2b3c4d`,
 * with the route pattern and the names of its parameters. Values are never
 * printed (an auth link's `code` arrives as a parameter) and IDs in the path
 * are shortened. Mount once in the root layout, only when debug logs are on.
 */
export function NavigationLogger() {
  const pathname = usePathname();
  const route = `/${useSegments().join('/')}`;
  const paramNames = Object.keys(useGlobalSearchParams()).sort().join(',');

  useEffect(() => {
    debugLog('nav', `→ ${shortenIds(pathname)}`, { route, ...(paramNames ? { params: paramNames } : {}) });
  }, [pathname, route, paramNames]);

  return null;
}
