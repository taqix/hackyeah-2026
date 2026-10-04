import { useEffect, useInsertionEffect, useRef } from 'react';

/**
 * Web: when a modal closes, puts keyboard focus back on what opened it.
 * React Native Web's modal does this too, but it remembers whatever has focus
 * once the modal is up, which is the field itself when one inside autofocuses;
 * then focus falls to the page and a keyboard user starts again from the top.
 * Only steps in when focus did fall to the page. iOS and Android:
 * focus-return.native.ts (nothing).
 */
export function useFocusReturn(open: boolean): void {
  const opener = useRef<HTMLElement | null>(null);

  // Insertion effects run before React focuses an autoFocus field inside the modal.
  useInsertionEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, [open]);

  useEffect(() => {
    if (open) return;
    const target = opener.current;
    opener.current = null;
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (target && lost && document.contains(target)) target.focus();
  }, [open]);
}
