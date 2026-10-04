import { useEffect, useEffectEvent } from 'react';

import type { GymKeys } from './use-gym-keys';

/** A focused control answers Space and Enter itself; typing keeps every key. */
const CONTROL = 'button, a, [role="button"], [role="link"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"]';

function isTyping(target: HTMLElement | null): boolean {
  return !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * The guided gym's keyboard on the desktop web: Space or Enter for the main
 * button, arrows for the open set's reps and weight, P to pause a round and +
 * for more rest. Keys typed into a field, and Space or Enter on a focused
 * button, are left alone.
 */
export function useGymKeys(keys: GymKeys): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!keys.enabled || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (isTyping(target)) return;
    const run = (action: (() => void) | undefined) => {
      if (!action) return;
      event.preventDefault();
      action();
    };
    switch (event.key) {
      case ' ':
      case 'Enter':
        if (event.repeat || target?.closest(CONTROL)) return;
        run(keys.onPrimary);
        return;
      case 'ArrowUp':
        run(keys.onReps && (() => keys.onReps?.(1)));
        return;
      case 'ArrowDown':
        run(keys.onReps && (() => keys.onReps?.(-1)));
        return;
      case 'ArrowRight':
        run(keys.onWeight && (() => keys.onWeight?.(1)));
        return;
      case 'ArrowLeft':
        run(keys.onWeight && (() => keys.onWeight?.(-1)));
        return;
      case 'p':
      case 'P':
        run(keys.onPause);
        return;
      case '+':
      case '=':
        run(keys.onExtend);
        return;
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
