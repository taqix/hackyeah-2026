import { Platform, type ViewStyle } from 'react-native';

/** Cursors the web panel uses; React Native's style types only list `auto` and `pointer`. */
export type WebCursor = 'auto' | 'default' | 'pointer' | 'not-allowed' | 'progress' | 'grab' | 'grabbing' | 'text';

/**
 * A view style with the CSS values React Native Web applies but React Native's
 * types leave out: any cursor, and `sticky` or `fixed` positioning.
 */
export type WebStyle = Omit<ViewStyle, 'cursor' | 'position'> & {
  cursor?: WebCursor;
  position?: ViewStyle['position'] | 'sticky' | 'fixed';
};

/**
 * Web-only style: React Native Web hands it to CSS as it is, iOS and Android
 * get nothing, so native layouts cannot change. This is the one place the kit
 * widens React Native's style types to what the browser accepts, e.g.
 * `webStyle({ position: 'sticky', top: 24 })` for a side column.
 */
export function webStyle(style: WebStyle): ViewStyle | null {
  return Platform.OS === 'web' ? (style as ViewStyle) : null;
}
