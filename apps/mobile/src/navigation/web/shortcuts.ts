/** Keyboard shortcuts of the desktop web shell. Web only: `navigator` and `KeyboardEvent` are the browser's. */

/** ⌘ on Apple keyboards, Ctrl elsewhere. */
function isApple(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** ⌘K / Ctrl+K opens or closes the coach, from anywhere in the panel, typing included. */
export function isCoachShortcut(event: KeyboardEvent): boolean {
  const modifier = isApple() ? event.metaKey : event.ctrlKey;
  return modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
}

/** How the coach shortcut reads on this keyboard: "⌘K" or "Ctrl K". */
export function coachShortcutLabel(): string {
  return isApple() ? '⌘K' : 'Ctrl K';
}
