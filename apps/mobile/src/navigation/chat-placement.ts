import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * Where chat sits (design: Chat placement, waiting on a UX test).
 * tab: Today · Calendar · Chat · You. button: a shorter bar plus a round chat button
 * that opens chat full screen over the current tab.
 */
export type ChatPlacement = 'tab' | 'button';

const STORAGE_KEY = 'movo.chat-placement';
let placement: ChatPlacement = 'tab';
let hydrated = false;
let changedLocally = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function hydrate() {
  hydrated = true;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    // A choice made while storage was being read wins over the stored one.
    if (changedLocally) return;
    if ((stored === 'tab' || stored === 'button') && stored !== placement) {
      placement = stored;
      emit();
    }
  } catch {
    // Storage unavailable (web private mode): keep the default.
  }
}

export const chatPlacementStore = {
  get: () => placement,
  set(next: ChatPlacement) {
    hydrated = true;
    changedLocally = true;
    if (next === placement) return;
    placement = next;
    emit();
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (!hydrated) void hydrate();
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useChatPlacement(): [ChatPlacement, (next: ChatPlacement) => void] {
  const value = useSyncExternalStore(
    chatPlacementStore.subscribe,
    chatPlacementStore.get,
    chatPlacementStore.get,
  );
  return [value, chatPlacementStore.set];
}
