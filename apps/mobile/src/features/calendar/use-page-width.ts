import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { DESKTOP_CONTENT_MAX_WIDTH, DESKTOP_GUTTER, useLayout } from '@/components/layout';

/** The desktop shell's sidebar (labelled on wide windows, an icon rail on medium ones): only a first guess. */
const SIDEBAR = { wide: 248, medium: 84 } as const;

/**
 * The width of a desktop page's content, measured from its scroll area (pass
 * `onLayout` to the page's Content), so a docked coach panel narrows it too.
 * Until the first measure it is guessed from the window.
 */
export function usePageWidth(maxWidth: number = DESKTOP_CONTENT_MAX_WIDTH) {
  const { width, isWide } = useLayout();
  const [pane, setPane] = useState<number | null>(null);
  const guess = width - (isWide ? SIDEBAR.wide : SIDEBAR.medium);
  return {
    width: Math.min(maxWidth, (pane ?? guess) - DESKTOP_GUTTER * 2),
    onLayout: (event: LayoutChangeEvent) => setPane(event.nativeEvent.layout.width),
  };
}
