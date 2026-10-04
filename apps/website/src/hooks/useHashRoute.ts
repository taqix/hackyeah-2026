/* The current route, kept in sync with the address bar. */

import { useEffect, useState } from "react";
import { parseRoute, type Route } from "../routing";

export interface HashRoute {
  route: Route;
  /** Counts navigations, including re-navigating to the route already shown, so
      per-route effects such as scrolling and focus run again. */
  navigationId: number;
}

export function useHashRoute(): HashRoute {
  const [hash, setHash] = useState(location.hash);
  const [navigationId, setNavigationId] = useState(0);

  useEffect(() => {
    /* The app decides where to scroll on every route, so the browser must not. */
    history.scrollRestoration = "manual";
    const sync = () => {
      setHash(location.hash);
      setNavigationId(id => id + 1);
    };
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);

  return { route: parseRoute(hash), navigationId };
}
