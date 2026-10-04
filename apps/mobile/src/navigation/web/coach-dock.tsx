import { createContext, type ReactNode, use, useMemo, useState } from 'react';

import type { ChatRouteParams } from '../routes';
import { useShellVisible } from './shell-visibility';

export type CoachDock = {
  /**
   * Whether the coach opens beside the page: the desktop web shell is on screen.
   * Elsewhere (phones, the web below 768 px, focus screens) chat is the /coach page.
   */
  available: boolean;
  open: boolean;
  /** How the latest open request asked for the conversation (prefill, about, intent). */
  params: ChatRouteParams;
  /** A new value per open request, so the same request twice applies again. */
  openKey: number;
  /** Opens the dock as a fresh request: `params` fill the box, attach a session or ask to move it. */
  show: (params?: ChatRouteParams) => void;
  hide: () => void;
  /** Opens or closes the dock as it was, keeping the draft and the last request. */
  toggle: () => void;
};

type DockState = Pick<CoachDock, 'open' | 'params' | 'openKey'>;

const CLOSED: DockState = { open: false, params: {}, openKey: 0 };

const CoachDockContext = createContext<CoachDock>({
  ...CLOSED,
  available: false,
  show: () => undefined,
  hide: () => undefined,
  toggle: () => undefined,
});

export type CoachDockProviderProps = {
  /** The signed-in account; a different one starts with the dock closed. */
  accountId: string | null;
  children: ReactNode;
};

/**
 * Holds the coach dock's state for the desktop web shell, inside its
 * ShellVisibility: the dock is available while the shell is on screen.
 * Without the provider the dock is never available.
 */
export function CoachDockProvider({ accountId, children }: CoachDockProviderProps) {
  const available = useShellVisible();
  const [state, setState] = useState(CLOSED);
  const [account, setAccount] = useState(accountId);
  if (account !== accountId) {
    setAccount(accountId);
    setState(CLOSED);
  }

  const value = useMemo<CoachDock>(
    () => ({
      ...state,
      available,
      show: (params = {}) => setState((current) => ({ open: true, params, openKey: current.openKey + 1 })),
      hide: () => setState((current) => ({ ...current, open: false })),
      // Flips what is on screen, not what is queued: a press the browser reports twice (keyboard
      // Enter on a button) still toggles once.
      toggle: () => setState((current) => ({ ...current, open: !state.open })),
    }),
    [available, state],
  );
  return <CoachDockContext value={value}>{children}</CoachDockContext>;
}

/** The coach dock, or a never-available stand-in outside the desktop web shell. */
export function useCoachDock(): CoachDock {
  return use(CoachDockContext);
}
