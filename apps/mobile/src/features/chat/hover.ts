import { useState } from 'react';
import { Platform } from 'react-native';

const ON_WEB = Platform.OS === 'web';

/**
 * Mouse hover on the web, for a Pressable's `onHoverIn`/`onHoverOut`. Touch
 * never sets it, and the apps on iOS and Android keep their look.
 */
export function useHover(): { hovered: boolean; hoverProps: { onHoverIn?: () => void; onHoverOut?: () => void } } {
  const [hovered, setHovered] = useState(false);
  if (!ON_WEB) return { hovered: false, hoverProps: {} };
  return { hovered, hoverProps: { onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false) } };
}
