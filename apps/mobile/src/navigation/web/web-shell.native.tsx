import type { ReactNode } from 'react';

/** iOS and Android have no desktop shell: the root stack alone, as before. See web-shell.tsx for the web. */
export function WebShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
