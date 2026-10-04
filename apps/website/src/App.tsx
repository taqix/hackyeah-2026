/* The site's shell: the landing page in its frame. Old links into the demo this site used
   to host are sent on to the app's guest entry instead. */

import { useLayoutEffect } from "react";
import { GUEST_ENTRY } from "./appLinks";
import { SiteFooter, SiteHeader } from "./components/chrome";
import { Landing } from "./components/landing";
import { useBreakpoint } from "./hooks/useMediaQuery";
import { useHashRoute } from "./hooks/useHashRoute";
import { scrollToPageTop, useRouteFocus } from "./hooks/useRouteFocus";
import { useTheme } from "./hooks/useTheme";
import * as route from "./routing";

/** The skip link's target, which is also where focus lands on every route. */
const MAIN_ID = "s-main";

export function App() {
  const { route: current, navigationId } = useHashRoute();
  const breakpoint = useBreakpoint();
  const { theme, toggle: toggleTheme } = useTheme();

  const leaving = current.view === "guest";
  useLayoutEffect(() => {
    if (leaving) route.redirect(GUEST_ENTRY);
  }, [leaving]);

  /* Nothing to focus or scroll to while the page is about to be left. */
  useRouteFocus({ route: current, navigationId, active: !leaving });

  if (leaving) return null;
  return (
    <>
      <a
        className="s-skip"
        href={route.LANDING}
        onClick={event => {
          event.preventDefault();
          document.getElementById(MAIN_ID)?.focus();
        }}
      >
        Skip to content
      </a>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} />
      <main id={MAIN_ID} tabIndex={-1}>
        <Landing breakpoint={breakpoint} />
      </main>
      <SiteFooter onBackToTop={scrollToPageTop} />
    </>
  );
}
