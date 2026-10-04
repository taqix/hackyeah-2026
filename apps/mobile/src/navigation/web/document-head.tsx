import { useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';

import { useTheme } from '@/theme';

import { withAlpha } from '../nav-colors';
import { documentTitle } from './shell-routes';

/**
 * The browser document around the app: the tab's title for the page on screen
 * ("Calendar · Movo"; a screen's own <Head> title wins), and the resolved theme
 * for the page itself (background behind the app, browser chrome colour,
 * scrollbars, text selection), so Settings › Appearance wins over the system
 * colours the static HTML starts with (app/+html.tsx).
 */
export function DocumentHead() {
  const segments = useSegments();
  const { colors, scheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = scheme;
    root.style.setProperty('--movo-bg', colors.bgApp);
    root.style.setProperty('--movo-scrollbar', colors.borderStrong);
    root.style.setProperty('--movo-scrollbar-hover', colors.textTertiary);
    root.style.setProperty('--movo-selection', withAlpha(colors.accent, 0.26));
    root.style.setProperty('--movo-focus', colors.focusRing);
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute('content', colors.bgApp);
  }, [colors, scheme]);

  return (
    <Head>
      <title>{documentTitle(segments)}</title>
    </Head>
  );
}
