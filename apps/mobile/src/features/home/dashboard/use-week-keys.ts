import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type WeekKeys = {
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onThisWeek: (() => void) | null;
};

/** Typing in a field, or a dialog over the page: the keys belong to them. */
function keysTaken(target: EventTarget | null): boolean {
  if (typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]')) return true;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Desktop web shortcuts for the week: ← and → page it, T comes back to this
 * week. Only while `active` (the Today tab is on screen) and never while a
 * field or a dialog has the keys.
 */
export function useWeekKeys(active: boolean, keys: WeekKeys) {
  const latest = useRef(keys);
  useEffect(() => {
    latest.current = keys;
  });

  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (keysTaken(event.target)) return;
      const { onPrev, onNext, onThisWeek } = latest.current;
      const action =
        event.key === 'ArrowLeft' ? onPrev : event.key === 'ArrowRight' ? onNext : event.key.toLowerCase() === 't' ? onThisWeek : null;
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);
}
