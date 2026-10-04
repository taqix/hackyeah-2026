import { useState } from 'react';

import { DOCK_WIDTH } from './shell-metrics';

/** This browser's last dock width: a per-viewer convenience, so storage may fail or be empty. */
const STORAGE_KEY = 'movo.coachDockWidth';

function storedWidth(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(STORAGE_KEY));
    return value >= DOCK_WIDTH.min && value <= DOCK_WIDTH.max ? value : DOCK_WIDTH.initial;
  } catch {
    return DOCK_WIDTH.initial;
  }
}

/** The coach dock's width on wide screens, as the person last dragged it. */
export function useDockWidth(): [number, (width: number) => void] {
  const [width, setWidth] = useState(storedWidth);
  const update = (next: number) => {
    const rounded = Math.round(next);
    setWidth(rounded);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, String(rounded));
    } catch {
      // Private mode or blocked storage: the width just isn't remembered.
    }
  };
  return [width, update];
}
