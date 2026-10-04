import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, use, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

import {
  colors,
  type ColorScheme,
  fontFamily,
  layout,
  motion,
  radius,
  type SemanticColors,
  type Shadow,
  shadows,
  space,
  type,
} from './tokens';

/** Settings › Appearance: follow the phone, or force light or dark. */
export type Appearance = 'system' | 'light' | 'dark';

const APPEARANCE_KEY = 'movo.appearance';
let appearance: Appearance = 'system';
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const appearanceStore = {
  get: () => appearance,
  set(next: Appearance) {
    if (next === appearance) return;
    appearance = next;
    emit();
    AsyncStorage.setItem(APPEARANCE_KEY, next).catch(() => undefined);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async hydrate() {
    try {
      const stored = await AsyncStorage.getItem(APPEARANCE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        appearance = stored;
        emit();
      }
    } catch {
      // Storage unavailable (web private mode): keep following the system.
    }
  },
};

export function useAppearance(): [Appearance, (next: Appearance) => void] {
  const value = useSyncExternalStore(appearanceStore.subscribe, appearanceStore.get, appearanceStore.get);
  return [value, appearanceStore.set];
}

export type Theme = {
  scheme: ColorScheme;
  colors: SemanticColors;
  shadows: Record<1 | 2 | 3, Shadow>;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  layout: typeof layout;
  motion: typeof motion;
  fontFamily: typeof fontFamily;
};

function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: colors[scheme],
    shadows: shadows[scheme],
    space,
    radius,
    type,
    layout,
    motion,
    fontFamily,
  };
}

const themes: Record<ColorScheme, Theme> = { light: buildTheme('light'), dark: buildTheme('dark') };

const ThemeContext = createContext<Theme>(themes.light);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference] = useAppearance();
  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  useEffect(() => {
    void appearanceStore.hydrate();
  }, []);

  const value = useMemo(() => themes[scheme], [scheme]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

/** The resolved theme: semantic colors for the active scheme plus static tokens. */
export function useTheme(): Theme {
  return use(ThemeContext);
}
