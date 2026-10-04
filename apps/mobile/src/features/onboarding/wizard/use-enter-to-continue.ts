import { useIsFocused } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const TEXT_FIELDS = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/**
 * Whether the last interaction was the pointer. Browsers count any key press
 * as keyboard use (:focus-visible turns on), so the wizard remembers instead.
 */
let pointerLast = false;

/**
 * Whether Enter belongs to the focused element rather than the wizard: a text
 * field (the sport search picks with it), or a control reached with the
 * keyboard, which Enter presses. A choice just clicked with the mouse keeps
 * focus, and then Enter continues, as in a web form.
 */
function enterBelongsTo(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  if (target === document.body || !target.isConnected) return false;
  // A button left focused on the step that just closed is hidden now.
  if (target.getClientRects().length === 0) return false;
  if (target.closest(TEXT_FIELDS)) return true;
  // A slider takes arrows, never Enter.
  if (target.tabIndex < 0 || target.closest('[role="slider"]')) return false;
  return !pointerLast;
}

/**
 * Enter continues (desktop web) while this screen is focused; Ctrl or Cmd +
 * Enter continues from anywhere, a text field too. While the step can't
 * continue, Enter on the page does nothing.
 */
export function useEnterToContinue(enabled: boolean, onContinue: () => void): void {
  const focused = useIsFocused();
  const latest = useRef({ enabled, onContinue });
  useEffect(() => {
    latest.current = { enabled, onContinue };
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !focused) return undefined;
    const onPointerDown = () => {
      pointerLast = true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') {
        if (!MODIFIERS.has(event.key)) pointerLast = false;
        return;
      }
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.shiftKey) return;
      const shortcut = event.metaKey || event.ctrlKey;
      if (!shortcut && enterBelongsTo(event.target)) return;
      // Captured before React sees it, so a clicked card isn't pressed again.
      event.preventDefault();
      event.stopPropagation();
      if (latest.current.enabled) latest.current.onContinue();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [focused]);
}
