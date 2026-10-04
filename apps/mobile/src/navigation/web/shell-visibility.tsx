import { createContext, type ReactNode, use } from 'react';

const ShellVisibleContext = createContext(false);

/** Set by the desktop web shell (web-shell.tsx) for everything inside it. */
export function ShellVisibility({ visible, children }: { visible: boolean; children: ReactNode }) {
  return <ShellVisibleContext value={visible}>{children}</ShellVisibleContext>;
}

/**
 * Whether the desktop web shell (sidebar and coach dock) frames the page on
 * screen. Always false on iOS, Android and the web below 768 px, which keep
 * the floating tab bar and the /coach page.
 */
export function useShellVisible(): boolean {
  return use(ShellVisibleContext);
}
