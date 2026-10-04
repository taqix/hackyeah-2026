/** No hardware-keyboard handling on iOS and Android: screen readers use the accessibility actions. See web-keyboard.ts. */
export function useWebKeyboard(): void {}

/** Nothing on iOS and Android; see web-keyboard.ts. */
export function useArrowKeyRadios(): void {}
