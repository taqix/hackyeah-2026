import { type RefObject, useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

/**
 * Esc closes the dock on the web while focus is inside it, or while nothing
 * has focus and the last click was inside it (a click on a message moves
 * focus to the page). It leaves the key to anything else that has it first (a
 * dialog, a menu) and does nothing while the dock is hidden. The message box
 * handles its own Esc: React Native Web's text inputs keep key events from
 * bubbling up here.
 */
export function useEscapeToClose(enabled: boolean, rootRef: RefObject<View | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return undefined;
    // React Native Web hands over the DOM node as the View's ref.
    const root = () => rootRef.current as unknown as HTMLElement | null;
    let clickedInside = false;
    const onPointerDown = (event: PointerEvent) => {
      clickedInside = root()?.contains(event.target as Node) ?? false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      const node = root();
      // A dock kept mounted while closed has no boxes on screen.
      if (!node || node.getClientRects().length === 0) return;
      const active = document.activeElement;
      const idle = !active || active === document.body;
      if (!node.contains(active) && !(idle && clickedInside)) return;
      event.preventDefault();
      close.current();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, rootRef]);
}
