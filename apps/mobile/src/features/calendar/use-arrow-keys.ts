import { type RefObject, useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

export type ArrowKeys<T> = {
  /** Where a key moves from the current item, or null for a key that does nothing here. */
  target: (key: string, from: T) => T | null;
  /** Selects the item and says whether it could (some items cannot be picked). */
  pick: (item: T) => boolean;
  /** The DOM id of an item's element, so focus can follow the selection. */
  idOf: (item: T) => string;
};

/**
 * Keyboard moves between the items inside `ref` (web only), as in a date
 * picker or a list box: the key picks the item it points to, then focus
 * follows to that item's element once it is on screen. Keys with a modifier
 * are left to the browser.
 */
export function useArrowKeys<T>(ref: RefObject<View | null>, selected: T, keys: ArrowKeys<T>) {
  const latest = useRef({ selected, keys });
  const pending = useRef<{ item: T } | null>(null);

  useEffect(() => {
    latest.current = { selected, keys };
  });

  useEffect(() => {
    // React Native Web renders a View as a DOM element.
    const node = Platform.OS === 'web' ? (ref.current as unknown as HTMLElement | null) : null;
    if (!node) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const { selected: from, keys: current } = latest.current;
      const to = current.target(event.key, from);
      if (to === null) return;
      // The page would scroll otherwise.
      event.preventDefault();
      if (to !== from && current.pick(to)) pending.current = { item: to };
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [ref]);

  useEffect(() => {
    if (!pending.current || pending.current.item !== selected) return;
    pending.current = null;
    document.getElementById(latest.current.keys.idOf(selected))?.focus();
  }, [selected]);
}
