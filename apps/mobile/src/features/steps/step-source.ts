import type { StepSource } from './step-counter';

// Metro selects the .ios/.android implementation on phones; this is the web fallback.
export const stepSource: StepSource = {
  name: 'unsupported',
  getUnavailableReason: async () => 'System step counts are only available on Android and iOS.',
  hasPermission: async () => false,
  requestPermission: async () => false,
  readSteps: async () => { throw new Error('Step counts are unavailable on this platform.'); },
  openSettings: async () => {},
};
