# Feature: FIT/GPX activity file import

Status: ready for review; physical-device verification pending.

## Problem and scope

The mobile app needs a reusable way to select an activity export and obtain
structured data for a future activity screen. The service opens the system
document picker, reads one file, parses it locally, and returns JSON-safe data.
No UI, upload, persistence, authentication, or automatic plan completion is added.
No account or provider connection is required.

Implementation: `apps/mobile/src/services/activity-import/`.

## Usage

Call directly from a button press (also required for browser file pickers):

```ts
import { activityImport, ActivityImportError } from '@/services/activity-import';

async function importActivity() {
  try {
    const result = await activityImport.pickAndImport();
    if (result.status === 'cancelled') return;

    // Pass this to future preview/state/persistence code.
    return result.data;
  } catch (error) {
    if (error instanceof ActivityImportError) {
      // Map error.code to localized UI copy. Retrying means selecting a file again.
      // Do not log the cause: it may contain personal file details.
      throw error;
    }
    throw error;
  }
}
```

The parser can also be called without any device APIs:

```ts
import { parseActivityFile } from '@/services/activity-import/parser';

const data = parseActivityFile({ fileName: 'run.fit', bytes }); // Uint8Array
```

Use the `/parser` entry for Node-side scripts/tests so Expo modules are not loaded.
`createActivityImportService(picker)` accepts a custom picker driver for tests or
another file source. Each selected file supplies `readBytes()` and `dispose()`.
The application uses the exported singleton to reject concurrent picker calls.

## Access and permissions

Selecting a document in the OS picker grants access to that document. There is
no separate global `requestPermission()` step and no broad storage, location,
photo-library or health-data permission. The Android Storage Access Framework
explicitly does not require system permissions for user-selected documents.
[Android document access](https://developer.android.com/training/data-storage/shared/documents-files)

The native adapter uses `expo-document-picker` with `copyToCacheDirectory: true`
and `expo-file-system`'s `File.arrayBuffer()`. This makes the chosen document
readable immediately; a `finally` block removes only the temporary app-owned
copy after success or failure. Cleanup failure does not replace the import
result; an undeleted cache copy is left for OS eviction. The user's original
document is never modified. Web uses the browser `File` and revokes the picker's
object URL after reading.
[Expo picker](https://docs.expo.dev/versions/latest/sdk/document-picker/),
[Expo file access](https://docs.expo.dev/versions/latest/sdk/filesystem/)

The picker allows all MIME types because providers label FIT/GPX inconsistently.
The service requires a `.fit` or `.gpx` extension (case-insensitive) and validates
the content. Losing access or failing to download a cloud document surfaces as
`picker-failed` or `read-failed`, not an empty successful import.

## Result contract

`ActivityImport` contains file metadata (`fileName`, `format`, `sizeBytes`) and
`activities`. There is one item per FIT session or GPX track/route.

| Fields | Meaning |
| --- | --- |
| `name`, `sport`, `kind` | Source name and sport; GPX routes have `kind: 'route'`, distinct from recorded activities. No app sport mapping is guessed. |
| `startTime`, `endTime` | ISO UTC strings; `null` if unavailable. GPX timestamps require an explicit timezone. |
| `elapsedTimeSeconds`, `timerTimeSeconds` | Wall-clock duration versus FIT timer duration excluding pauses. GPX timer time is unknown. |
| `distanceMeters`, `distanceSource` | Device summary when available; otherwise haversine distance within GPS segments. A single point has unknown distance. |
| `caloriesKcal`, `averageHeartRateBpm`, `maxHeartRateBpm` | FIT session values when present. Missing summaries are not synthesized from irregular samples. |
| `samples` | Timestamp, segment index, latitude/longitude in degrees, altitude/distance in meters, speed in m/s, HR in bpm, source cadence in cycles/minute, power in watts. |

All unavailable measurements are `null`. Zero remains zero. A GPX `trkseg` gap
never contributes distance; consumers must also respect `segmentIndex` when
drawing routes. FIT positions are converted from semicircles to degrees.
FIT units/epochs/scaling, compressed records and invalid-value handling come from
the official [Garmin FIT SDK](https://github.com/garmin/fit-javascript-sdk).
Parsing requires a valid FIT header, length and CRC; course/workout-definition
files are rejected. Indoor sessions work without GPS or samples. FIT sessions
share boundary timestamps by assigning that sample only to the later session;
ambiguous samples outside every session or sessions with missing boundaries fail.

GPX 1.0/1.1 tracks, routes, prefixed XML and common Garmin TrackPointExtension
HR/cadence are supported, along with speed/power where supplied. Waypoint-only
files return `no-activities`. Unknown extensions, FIT laps/developer fields and
other sensor streams are currently omitted. FIT fractional cadence is omitted;
running cadence is preserved in source cycles/minute, not doubled to steps/minute.

This is a local import model, not an authenticated backend API contract. Future
persistence/upload must explicitly map it to shared contracts and user ownership.
A parsed route or activity does not mark a planned activity complete.

## Limits and failures

The service allows at most 10 MiB and 100,000 samples across a file. It checks
available size metadata before reading and actual byte length before parsing.
The native picker may already have copied a large document before the service
can inspect its size. Parsing happens synchronously in JS after the asynchronous
read; large-file background processing is deferred. GPX must be UTF-8; malformed
XML, DTD/entity declarations, invalid coordinates and invalid timestamps fail.

| Outcome/code | Consumer behavior |
| --- | --- |
| `{ status: 'cancelled' }` | Normal cancellation; keep existing state. |
| `busy` | Wait for the active import; do not open another picker. |
| `picker-failed`, `read-failed` | Explain file/provider access failed; allow re-selection. |
| `unsupported-format` | Ask for a FIT or GPX export. |
| `file-too-large` | Explain the byte/sample limits. |
| `invalid-file` | Ask for a fresh export; no partial import is returned. |
| `no-activities` | Explain that the file contains no supported activities/routes. |

## Acceptance and verification

- [x] Pure parsers return a common JSON-safe format for GPX and binary FIT.
- [x] Cancellation, read failure, invalid/oversized input, retries and concurrent
  imports are tested through a fake picker; cache cleanup is covered.
- [x] Fixtures are synthetic and contain no participant data. FIT test files are
  encoded as binary with the SDK; decoder results are checked against known units.
- [x] `npm run test:activity-import --workspace=@hackyeah/mobile` — 26 passing tests.
- [x] `npm run typecheck` — app and tests pass.
- [x] `npm run lint` — passes.
- [ ] System picker/read/delete behavior on a physical iOS and Android device.
- [ ] Real device/vendor exports beyond the synthetic fixtures.
- [ ] Teammate review.

Metro bundle checks use a temporary entry importing the public service (the
starter UI does not import it yet). These check native dependency resolution,
not device permissions, file-provider behavior or real Hermes execution.
Both iOS and Android checks passed using `npx expo export:embed --entry-file
.scratch/activity-import/entry.js --platform <ios|android> --dev false
--bundle-output .scratch/activity-import/<platform>.jsbundle --max-workers 2`
from `apps/mobile`. The temporary entry imports `expo/src/winter` and this
module's public API and exposes the API on a global to keep it in the bundle.

Manual smoke procedure after adding a caller: pick the synthetic GPX fixture
from Files/Downloads, observe one activity and four samples, cancel and retry,
pick a corrupt/unsupported file, then select a valid FIT activity. Verify that
the original document remains and no global storage permission prompt appears.
Repeat with a cloud-provider document and offline/provider access failure. On
web, call directly from user interaction; browser cancellation behavior varies.

## Deployment and rollback

Run `npm ci` from the root after pulling the dependency changes. Native packages
match Expo SDK 57. Existing custom native builds must be rebuilt to include the
new picker; a compatible Expo Go provides these Expo modules. No app config,
environment variables, database migrations or backend deployment is needed.
Remove the caller/module and dependency additions to roll back.
