import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { type CalendarPermission, deviceCalendar } from '@/services/calendar';

const UNAVAILABLE: CalendarPermission = { status: 'unavailable', canAskAgain: false };

/** The row's state: checking on focus, then off · connected · denied (or unavailable on web and Expo Go). */
export type CalendarAccess = 'checking' | 'off' | 'connected' | 'denied' | 'unavailable';

function accessOf(permission: CalendarPermission | null): CalendarAccess {
  if (!permission) return 'checking';
  switch (permission.status) {
    case 'granted':
      return 'connected';
    case 'denied':
      return 'denied';
    case 'unavailable':
      return 'unavailable';
    case 'undetermined':
      return 'off';
  }
}

async function currentPermission(): Promise<CalendarPermission> {
  try {
    return await deviceCalendar.getPermission();
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * Calendar access for Review (4). The OS state is read without prompting when
 * the screen gains focus and when the app returns from the phone's settings;
 * only `connect`, from an explicit tap, asks.
 */
export function useCalendarAccess() {
  const [permission, setPermission] = useState<CalendarPermission | null>(null);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(() => {
    let active = true;
    void currentPermission().then((next) => {
      if (active) setPermission(next);
    });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const connect = async () => {
    setRequesting(true);
    try {
      setPermission(await deviceCalendar.requestPermission());
    } catch {
      setPermission(await currentPermission());
    } finally {
      setRequesting(false);
    }
  };

  const openSettings = () => {
    Linking.openSettings().catch(() => undefined);
  };

  return {
    access: accessOf(permission),
    /** Denied, but the OS will still show its dialog (Android after one refusal). */
    canAskAgain: permission?.canAskAgain ?? false,
    requesting,
    connect,
    openSettings,
  };
}
