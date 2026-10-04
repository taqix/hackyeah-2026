import { Pedometer } from 'expo-sensors';
import { Linking } from 'react-native';

import type { StepSource } from './step-counter';

export const stepSource: StepSource = {
  name: 'core-motion',
  async getUnavailableReason() {
    return await Pedometer.isAvailableAsync() ? null : 'This device has no available pedometer.';
  },
  async hasPermission() {
    return (await Pedometer.getPermissionsAsync()).granted;
  },
  async requestPermission() {
    const permission = await Pedometer.getPermissionsAsync();
    if (permission.granted || !permission.canAskAgain) return permission.granted;
    return (await Pedometer.requestPermissionsAsync()).granted;
  },
  async readSteps(start, end) {
    return (await Pedometer.getStepCountAsync(start, end)).steps;
  },
  openSettings: () => Linking.openSettings(),
};
