import { type RefObject, useEffect, useEffectEvent } from 'react';
import type { View } from 'react-native';

/** The part of a browser keydown the kit reads. */
export type WebKeyEvent = { key: string; shiftKey: boolean; preventDefault: () => void };

export type WebKeyboardHandlers = {
  /** A key went down while the view, or something inside it, had focus. */
  onKeyDown?: (event: WebKeyEvent) => void;
  /** Keyboard focus (:focus-visible) arrived at the view itself, or left it. */
  onFocusVisibleChange?: (visible: boolean) => void;
};

function elementOf(ref: RefObject<View | null>): HTMLElement | null {
  // React Native Web hands over the DOM node; anything else is not a page.
  const node: unknown = ref.current;
  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null;
}

/**
 * Keys and keyboard focus for a plain view on the web, where React Native's
 * View types offer neither: arrow keys on a slider, a focus ring drawn on its
 * thumb. iOS and Android: web-keyboard.native.ts (nothing; screen readers
 * use the accessibility actions).
 */
export function useWebKeyboard(ref: RefObject<View | null>, handlers: WebKeyboardHandlers): void {
  const keyDown = useEffectEvent((event: KeyboardEvent) => handlers.onKeyDown?.(event));
  const focusChange = useEffectEvent((visible: boolean) => handlers.onFocusVisibleChange?.(visible));

  useEffect(() => {
    const node = elementOf(ref);
    if (!node) return undefined;
    const onKeyDown = (event: KeyboardEvent) => keyDown(event);
    const onFocus = (event: FocusEvent) => {
      if (event.target === node) focusChange(node.matches(':focus-visible'));
    };
    const onBlur = (event: FocusEvent) => {
      if (event.target === node) focusChange(false);
    };
    node.addEventListener('keydown', onKeyDown);
    node.addEventListener('focusin', onFocus);
    node.addEventListener('focusout', onBlur);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      node.removeEventListener('focusin', onFocus);
      node.removeEventListener('focusout', onBlur);
    };
  }, [ref]);
}

/** Where an arrow, Home or End key moves in a row of `count` choices (wrapping), or null for any other key. */
function arrowTarget(key: string, from: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (from + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (from - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * Arrow keys in a radio group on the web (WAI-ARIA radio group): Right/Down
 * and Left/Up move to the next or previous choice and choose it, Home and End
 * to the first and last. Choosing clicks the radio, so its own onPress runs.
 */
export function useArrowKeyRadios(ref: RefObject<View | null>): void {
  useEffect(() => {
    const node = elementOf(ref);
    if (!node) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const radios = Array.from(node.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'));
      const from = radios.findIndex((radio) => radio === event.target);
      if (from < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
      const next = arrowTarget(event.key, from, radios.length);
      if (next === null) return;
      event.preventDefault();
      const radio = radios[next];
      if (!radio || next === from) return;
      radio.focus();
      radio.click();
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [ref]);
}
