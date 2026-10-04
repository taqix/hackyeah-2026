import { useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';

import { useTheme } from '@/theme';

import { withAlpha } from '../nav-colors';
import { FAVICON, GLOBAL_CSS } from './document-styles';
import { documentTitle } from './shell-routes';

/**
 * The SPA export (GitHub Pages) starts from Expo's plain template, not
 * app/+html.tsx: add the page style sheet, Movo's icon and a theme-color meta
 * when the document doesn't have them yet.
 */
function ensureDocumentBasics() {
  const head = document.head;
  if (!document.getElementById('movo-global')) {
    const style = document.createElement('style');
    style.id = 'movo-global';
    style.textContent = GLOBAL_CSS;
    head.appendChild(style);
  }
  if (!head.querySelector('link[rel="icon"][type="image/svg+xml"]')) {
    for (const link of head.querySelectorAll('link[rel~="icon"]')) link.remove();
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = FAVICON;
    head.appendChild(icon);
  }
  if (!head.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    head.appendChild(meta);
  }
}

/**
 * The browser document around the app: the tab's title for the page on screen
 * ("Calendar · Movo"; a screen's own <Head> title wins), and the resolved theme
 * for the page itself (background behind the app, browser chrome colour,
 * scrollbars, text selection), so Settings › Appearance wins over the system
 * colours the static HTML starts with (app/+html.tsx). The SPA export lacks that
 * document, so it adds the same style sheet and icon itself.
 */
export function DocumentHead() {
  const segments = useSegments();
  const { colors, scheme } = useTheme();

  useEffect(ensureDocumentBasics, []);

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
