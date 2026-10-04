import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { FAVICON, GLOBAL_CSS } from '@/navigation/web/document-styles';
import { colors } from '@/theme/tokens';

/*
 * The web's HTML document (static rendering and the dev server; never on iOS
 * or Android). It paints the app's paper background before any script runs,
 * in the system's light or dark, so a page never flashes white; once the app
 * runs, DocumentHead (navigation/web) keeps these values on the theme people
 * chose in Settings › Appearance.
 */

const { light, dark } = colors;

export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content={light.bgApp} />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={dark.bgApp} />
        <meta name="application-name" content="Movo" />
        <link rel="icon" type="image/svg+xml" sizes="any" href={FAVICON} />
        <ScrollViewStyleReset />
        <style id="movo-global" dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
