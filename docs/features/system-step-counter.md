# Feature: System daily step counter

Status: ready for device verification

## Problem and user outcome

Expose today's step count for future mobile UI, including steps recorded while
the app was closed. The app reads system history instead of running a sensor
listener or a background service.

## Scope and acceptance criteria

- Read the iPhone's Core Motion history from local midnight to the current time.
- Read Android's Health Connect `Steps` aggregate over the same range. Use all
  sources so the system includes phone steps and handles overlapping records.
- Request motion access on iOS and only `READ_STEPS` on Android. No write access,
  background-read permission, or Android activity-recognition permission.
- Share one count across screens; refresh on foreground entry, every minute
  while active, and on explicit request. Stop polling when inactive.
- Expose missing permission, unsupported devices, missing native builds, and
  read failures without presenting a fabricated zero.
- UI, server synchronization, account-specific history, and Apple Watch / Apple
  Health aggregation are deferred. Data stays on the device and is not uploaded.

## Integration

`useStepCounterTracking()` is already mounted once in the root layout. To consume
the value in any future screen:

```tsx
import { useStepCounter } from '@/hooks/use-step-counter';

const { steps, status, date, updatedAt, message, refresh, requestPermission, openSettings } = useStepCounter();
// steps: number | null. Render a count once status === 'ready'.
// permission-required: requestPermission(), or openSettings() after denial.
// error: show message and offer refresh().
// unavailable: show message; Android openSettings() can open Health Connect/install page.
```

The first foreground read requests access if needed. Later automatic refreshes in
that process never re-prompt after denial or revocation. `requestPermission()` is
the explicit retry action; iOS denial may require `openSettings()`. Errors from
`openSettings()` should be handled by its eventual UI caller.

Each refresh replaces the total; it never adds a previous read. `date` is local
`YYYY-MM-DD`; `updatedAt` is the query endpoint in ISO format. A new day clears the
old value before reading. No step totals are persisted by this app: after a cold
start it queries the system again. A successful zero means the system returned
no recorded steps for the range, which can also mean a data source is not set up.

## Platform setup and compatibility

- Run `npm install`, then `npm run android` or `npm run ios` from the repository
  root. Native development identifiers are `com.hackyeah2026.mobile` on both
  platforms. Rebuild after changing native dependencies or permission config.
- iOS uses `expo-sensors` / Core Motion with `NSMotionUsageDescription`. It reads
  the phone's recorded steps, not the merged Apple Health / Apple Watch total.
  The simulator generally has no usable pedometer; verify walking on a phone.
- Android uses `react-native-health-connect` and its Expo config plugin. Expo Go
  exposes `unavailable` with a native-build message instead of crashing.
- `expo-build-properties` sets Android's build minimum to API 26 (Android 8),
  as required by the Health Connect client dependency. Health Connect itself
  still has to be available on the particular device.
- Health Connect must be available and updated. Android 14+ with SDK extension
  20+ can record phone steps itself after any app receives `READ_STEPS`. Older
  supported devices need a connected app/device to write steps into Health
  Connect. Granting access does not create missing historical data.
- Health Connect writes can be delayed; this is a periodically refreshed daily
  total, not a per-footstep animation. No background permission is necessary for
  reading the stored total after reopening the app.
- Web reports `unavailable` and never requests mobile permissions.
- The Health Connect plugin registers its permission-rationale intents. Its
  default destination is the main activity; a dedicated explanation screen is
  part of the deferred UI work before store distribution.

References: [Expo Pedometer](https://docs.expo.dev/versions/v57.0.0/sdk/pedometer/),
[Android step reads and system collection](https://developer.android.com/health-and-fitness/health-connect/read-data),
[React Native Health Connect](https://github.com/matinzd/react-native-health-connect).

## Verification

- `npm test --workspace=@hackyeah/mobile`: 10 passing controller tests using a
  fake system source. Covers local midnight/DST, replacement of totals,
  permission denial/retry/revocation, concurrent permission requests, foreground
  reads, unsupported devices, native failures, and day rollover.
- `npm run typecheck` and `npm run lint`: passed.
- `npx expo export --platform all`: Android, iOS, and web bundles passed.
- Expo config introspection and Android prebuild: passed. Verified iOS motion
  wording, Android `READ_STEPS`, blocked activity recognition, and Health Connect
  permission activity entries.
- Native Android `:react-native-health-connect:compileDebugKotlin` and
  `:app:processDebugMainManifest`: passed after setting the required minimum API
  level to 26. This verifies the module compilation and manifest merge, not a
  full APK build or a live Health Connect read.
- `:react-native-health-connect-expo:compileDebugKotlin`: passed; the Expo
  permission-delegate integration also compiles. Final merged manifest contains
  `READ_STEPS` and the Health Connect provider query, with no activity-recognition
  or background-read permission. `npx expo install --check`: dependencies match
  the Expo SDK.
- Real sensor/Health Connect reads and real permission dialogs have **not** been
  verified on physical devices. Mock tests and JS exports do not prove them.

Device acceptance check: install a native build on each platform, allow access,
and inspect `useStepCounter()` through React Native DevTools or a temporary UI.
Walk with the app closed, reopen it after the system has saved the data, and
confirm the total updates. Deny/revoke access and confirm `permission-required`
with `steps: null`; re-enable in Settings and return. On Android also test a
device with no Health Connect data source. Confirm zero is not mistaken for a
fully configured tracker.

## Deployment and rollback

No backend, database migration, environment secrets, or account changes.
Native builds are required for the added Android module; JS-only updates cannot
add it. Reverting the root tracking hook disables automatic reads. Removing
native dependencies and manifest/plist entries requires another native build.
