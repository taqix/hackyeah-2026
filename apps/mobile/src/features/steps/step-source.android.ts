import { Linking, TurboModuleRegistry } from 'react-native';
import type { Permission } from 'react-native-health-connect';

import type { StepSource } from './step-counter';

const stepPermission: Permission = { accessType: 'read', recordType: 'Steps' };
const healthConnectStoreUrl = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

// Loading the package eagerly would crash Expo Go before we could report the missing module.
const loadHealthConnect = () => import('react-native-health-connect');
const isLinked = () => TurboModuleRegistry.get('HealthConnect') !== null;
const hasSteps = (permissions: { accessType: string; recordType?: string }[]) =>
  permissions.some(({ accessType, recordType }) => accessType === 'read' && recordType === 'Steps');

export const stepSource: StepSource = {
  name: 'health-connect',
  async getUnavailableReason() {
    if (!isLinked()) return 'Health Connect requires a native Android build; Expo Go is not supported.';
    const health = await loadHealthConnect();
    const status = await health.getSdkStatus();
    if (status === health.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'Install or update Health Connect to read steps.';
    }
    if (status !== health.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return 'Health Connect is unavailable on this device.';
    }
    return await health.initialize() ? null : 'Health Connect could not be initialized.';
  },
  async hasPermission() {
    return hasSteps(await (await loadHealthConnect()).getGrantedPermissions());
  },
  async requestPermission() {
    return hasSteps(await (await loadHealthConnect()).requestPermission([stepPermission]));
  },
  async readSteps(start, end) {
    const health = await loadHealthConnect();
    // Health Connect handles overlapping phone/watch records. Do not sum raw records
    // or filter data origins: that would double-count or exclude system-recorded steps.
    const result = await health.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    return result.COUNT_TOTAL;
  },
  async openSettings() {
    if (!isLinked()) throw new Error('Install a native Android build to use Health Connect.');
    const health = await loadHealthConnect();
    if (await health.getSdkStatus() === health.SdkAvailabilityStatus.SDK_AVAILABLE) {
      health.openHealthConnectSettings();
    } else {
      await Linking.openURL(healthConnectStoreUrl);
    }
  },
};
