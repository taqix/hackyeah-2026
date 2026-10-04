import { router, type Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { useLayout } from '@/components/layout';

import { type DialogSize, RouteDialog } from './route-dialog';
import { useHydrated } from './use-hydrated';

type StackProps = ComponentProps<typeof Stack>;
type ScreenLayout = NonNullable<StackProps['screenLayout']>;
type ScreenLayoutArgs = Parameters<ScreenLayout>[0];
type ScreenOptions = Exclude<NonNullable<StackProps['screenOptions']>, (...args: never[]) => unknown>;

/**
 * Root-stack routes the desktop web opens as dialogs over the page they came
 * from, and how wide: short tasks (feedback, logging a workout, changing one
 * answer). Everything else is a page beside the sidebar.
 */
const DIALOG_ROUTES: Readonly<Record<string, DialogSize>> = {
  'feedback/[logId]': 'sm',
  'log/[sessionId]': 'md',
  'profile/edit/[section]': 'md',
};

/** Dialogs from the medium breakpoint, once in the browser (the static HTML is the phone layout). */
function useDialogsFramed(): boolean {
  const { isDesktop } = useLayout();
  return useHydrated() && isDesktop;
}

/**
 * Screen options for the dialog routes: on desktop widths the page under one
 * stays on screen and shows through its transparent background. Empty on
 * phones and native, which keep their presentation.
 */
export function useDialogRouteOptions(): ScreenOptions {
  const framed = useDialogsFramed();
  return framed ? { presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } } : {};
}

function DialogRoute({ size, navigation, children }: Pick<ScreenLayoutArgs, 'navigation' | 'children'> & { size: DialogSize }) {
  const framed = useDialogsFramed();
  return (
    <RouteDialog
      size={size}
      framed={framed}
      isTop={() => navigation.isFocused()}
      onDismiss={() => {
        // Opened straight from a link, there is no page under it: land on Today.
        if (navigation.canGoBack()) navigation.goBack();
        else router.replace('/(tabs)');
      }}>
      {children}
    </RouteDialog>
  );
}

/** The root stack's screen layout on the web: dialog routes get their frame, every other screen is left as it is. */
export const webScreenLayout: ScreenLayout = ({ route, navigation, children }) => {
  const size = DIALOG_ROUTES[route.name];
  if (!size) return children;
  return (
    <DialogRoute size={size} navigation={navigation}>
      {children}
    </DialogRoute>
  );
};
