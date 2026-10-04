import { useCallback, useEffect, useState } from 'react';
import type { View } from 'react-native';

/**
 * Space picks the focused option of a radio group on the web, as it does for
 * a browser's own radios; the kit's options answer Enter and the arrow keys
 * only, and Space would scroll the page instead. Attach the returned ref to a
 * View around the group.
 */
export function useRadioKeys(): (view: View | null) => void {
  // On the web a View's ref is its DOM element.
  const [node, setNode] = useState<HTMLElement | null>(null);
  const ref = useCallback((view: View | null) => setNode(view as unknown as HTMLElement | null), []);

  useEffect(() => {
    if (!node) return undefined;
    const onKey = (event: KeyboardEvent) => {
      // Something inside (the kit) already handled this key.
      if (event.defaultPrevented || event.key !== ' ' || event.altKey || event.ctrlKey || event.metaKey) return;
      const option = event.target as HTMLElement;
      if (option.getAttribute('role') !== 'radio' || !node.contains(option)) return;
      event.preventDefault();
      option.click();
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [node]);

  return ref;
}
