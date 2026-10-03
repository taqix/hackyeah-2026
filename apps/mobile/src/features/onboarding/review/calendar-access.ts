import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import type { TimeSlot } from '@/api/types';
import { toIsoWithOffset } from '@/lib/dates';
import { CalendarError, type CalendarPermission, deviceCalendar, deviceCalendarAvailability } from '@/services/calendar';

const UNAVAILABLE: CalendarPermission = { status: 'unavailable', canAskAgain: false };
const PLAN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

/**
 * Free calendar time from `from` to a week later as plan slots, or null when
 * access is off. Null means "no calendar", never an empty one: the planner then
 * uses the preferred times.
 */
export async function freeSlotsForPlan(from: Date): Promise<TimeSlot[] | null> {
  const permission = await currentPermission();
  if (permission.status !== 'granted') return null;
  try {
    const slots = await deviceCalendarAvailability.getFreeSlots({
      startDate: from,
      endDate: new Date(from.getTime() + PLAN_WINDOW_MS),
    });
    return slots.map((slot) => ({
      start: toIsoWithOffset(slot.startDate),
      duration: Math.round((slot.endDate.getTime() - slot.startDate.getTime()) / 1000),
    }));
  } catch (error) {
    // Access revoked since the check: build without the calendar rather than as if it were empty.
    if (error instanceof CalendarError && (error.code === 'permission-denied' || error.code === 'unavailable')) {
      return null;
    }
    throw error;
  }
}
