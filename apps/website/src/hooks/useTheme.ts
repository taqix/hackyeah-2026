/* The light/dark switch. The theme lives on <html data-theme>, which index.html sets before
   paint from storage or the system setting; this hook follows it and writes the choice back. */

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "movo-site-theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export interface ThemeControl {
  theme: Theme;
  toggle: () => void;
}

export function useTheme(): ThemeControl {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  /* The system-preference listener in index.html can change the theme too. */
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Private browsing can refuse storage; the theme still applies for this visit. */
    }
    setTheme(next);
  };

  return { theme, toggle };
}
