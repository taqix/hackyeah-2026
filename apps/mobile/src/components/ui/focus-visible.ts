import type { NativeSyntheticEvent, TargetedEvent, ViewStyle } from 'react-native';

/** Only the outline keys, so the style also spreads into a TextInput's text style. */
export type OutlineStyle = Pick<ViewStyle, 'outlineStyle' | 'outlineWidth'>;

/**
 * Whether a focus came from the keyboard, so it should show a ring (CSS
 * :focus-visible): a click or tap focuses a pressable on the web too, without
 * one. A browser that cannot tell gets the ring. iOS and Android: always false
 * (focus-visible.native.ts).
 */
export function focusIsVisible(event: NativeSyntheticEvent<TargetedEvent>): boolean {
  // React Native Web hands over the DOM node; anything else cannot be checked.
  const node: unknown = event.nativeEvent.target;
  if (typeof Element === 'undefined' || !(node instanceof Element)) return true;
  try {
    return node.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * Hides the browser's own focus outline where the kit draws a rounded ring
 * instead. The browser's ring is `outline-style: auto`, which ignores
 * `outline-width: 0`, so the style is set too.
 */
export const noBrowserOutline: OutlineStyle = { outlineStyle: 'solid', outlineWidth: 0 };
