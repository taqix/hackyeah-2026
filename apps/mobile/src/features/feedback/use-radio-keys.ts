import type { View } from 'react-native';

const none = () => undefined;

/** Space on a radio option is a web feature (use-radio-keys.web.ts); phones choose by touch. */
export function useRadioKeys(): (view: View | null) => void {
  return none;
}
