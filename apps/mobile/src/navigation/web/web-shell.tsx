import { useSegments } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/api/hooks';
import { useLayout } from '@/components/layout';
import { useTheme } from '@/theme';

import type { TabRoute } from '../tab-items';
import { CoachDockProvider, useCoachDock } from './coach-dock';
import { CoachDockHost } from './coach-dock-host';
import { DocumentHead } from './document-head';
import { MAIN_MIN_BESIDE_DOCK, SIDEBAR_WIDTH } from './shell-metrics';
import { currentDestination, isShellRoute, tabOf } from './shell-routes';
import { ShellVisibility } from './shell-visibility';
import { isCoachShortcut } from './shortcuts';
import { Sidebar } from './sidebar';
import { useDockWidth } from './use-dock-width';
import { useHydrated } from './use-hydrated';

type Segments = ReturnType<typeof useSegments>;

/** The tab on screen, or the one a page over the tabs was opened from. */
function useLastTab(segments: Segments): TabRoute | null {
  const tab = tabOf(segments);
  const [last, setLast] = useState(tab);
  if (tab !== null && tab !== last) setLast(tab);
  return tab ?? last;
}

type ShellFrameProps = { visible: boolean; segments: Segments; children: ReactNode };

/**
 * [sidebar | page | coach dock] in a row. The page keeps its place in the row
 * whatever shows around it, so the navigator under it never remounts when the
 * shell comes and goes (signing in, the gym runner, crossing a breakpoint).
 */
function ShellFrame({ visible, segments, children }: ShellFrameProps) {
  const { colors } = useTheme();
  const { isWide, width } = useLayout();
  const dock = useCoachDock();
  const [dockWidth, setDockWidth] = useDockWidth();
  const lastTab = useLastTab(segments);
  // Beside an open dock the sidebar folds to its rail while the page would get too narrow.
  const railed = !isWide || (dock.open && width - SIDEBAR_WIDTH.wide - dockWidth < MAIN_MIN_BESIDE_DOCK);
  const { toggle } = dock;

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCoachShortcut(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, toggle]);

  return (
    <View style={[styles.frame, { backgroundColor: colors.bgApp }]}>
      {visible ? <Sidebar railed={railed} current={currentDestination(segments, lastTab)} /> : null}
      <View role={visible ? 'main' : undefined} style={styles.main}>
        {children}
      </View>
      {visible ? <CoachDockHost mode={isWide ? 'docked' : 'drawer'} width={dockWidth} onResize={setDockWidth} /> : null}
    </View>
  );
}

/**
 * The desktop web panel around the root stack: from 768 px, on the signed-in
 * app's pages, a sidebar replaces the phone's floating tab bar and the coach
 * opens in a dock beside the page. Sign-in, onboarding and the gym runner
 * stand alone, and below 768 px the web keeps the phone layout. It also keeps
 * the browser document's title and colours. iOS and Android:
 * web-shell.native.tsx (the stack alone).
 */
export function WebShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const segments = useSegments();
  const { isDesktop } = useLayout();
  const hydrated = useHydrated();
  // Shown while the session still loads, so a signed-in reload doesn't flash a page without it.
  const visible = hydrated && isDesktop && session.data !== null && isShellRoute(segments);

  return (
    <ShellVisibility visible={visible}>
      <CoachDockProvider accountId={session.data?.user.id ?? null}>
        <DocumentHead />
        <ShellFrame visible={visible} segments={segments}>
          {children}
        </ShellFrame>
      </CoachDockProvider>
    </ShellVisibility>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
});
