import { useIsFocused } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type CalendarShortcuts = {
  /** T */
  today: () => void;
  /** P */
  previousMonth: () => void;
  /** N */
  nextMonth: () => void;
};

/** A key press meant for a text field, not for the page. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The Calendar's single-key shortcuts on the web while its tab is on screen:
 * T for today, P and N for the previous and next month. Ignored while typing
 * and with a modifier held, so browser and system shortcuts keep working.
 */
export function useCalendarShortcuts(shortcuts: CalendarShortcuts) {
  const focused = useIsFocused();
  const latest = useRef(shortcuts);

  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !focused) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      const { today, previousMonth, nextMonth } = latest.current;
      const actions: Partial<Record<string, () => void>> = { t: today, p: previousMonth, n: nextMonth };
      const action = actions[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      action();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [focused]);
}
