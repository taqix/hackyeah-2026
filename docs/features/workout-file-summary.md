# Feature: FIT and GPX workout summaries

Status: ready for review
Owner: extraction workstream
Branch: `codex/fit-gpx-extraction`, based on `develop`

## Problem and user outcome

A workout log needs duration, distance and elevation metrics from a recorded
`.fit` or `.gpx` file. The existing manual FIT importer reads source session totals
and requires a connection context. `extractWorkoutSummary` adds a separate,
storage-independent summary API supporting both formats and derived moving time
and elevation gain. Its output is suitable for filling a workout summary form.

## Scope

- Included: TypeScript extraction in `packages/wearable-data`, shared runtime
  validation in `packages/contracts`, FIT activity sessions, GPX 1.1 tracks,
  per-session/track summaries, provenance, coverage and warnings.
- Deferred: persistence, authenticated upload endpoint, app file picker/form,
  GPX 1.0, non-activity FIT files, external elevation correction, and whole-file
  totals across overlapping sessions/tracks.
- Raw coordinates, device identifiers and detailed samples are used only inside
  a short-lived parser worker. The returned result contains summaries and counts
  of ignored routes/waypoints. Unknown sensor extensions produce warnings.
- Existing `importActivityFit`, wearable sync contracts and storage stay compatible.
  This API neither marks a workout complete nor modifies plans or preferences.

## Acceptance criteria

- [x] FIT and GPX files return validated, deterministic workout summaries.
- [x] Duration, distance and elevation units are explicit; absent values remain null.
- [x] Moving time remains separate from elapsed and device timer time.
- [x] Pauses, gaps, invalid times and segment boundaries are respected.
- [x] Malformed/corrupt/unsupported files fail with stable, sanitized error codes.
- [x] Worker output excludes raw locations, device identifiers and sensor series.
- [x] Existing wearable tests pass alongside new summary tests.
- Account ownership and client loading/retry flows: deferred to the upload/form
  integration; no HTTP endpoint, authentication assertion or database write exists.

## Design and compatibility

Use the current npm workspace and official JavaScript FIT SDK (`21.217.0`). GPX
uses the namespace-aware `saxes` parser (`6.0.0`); DTDs and undeclared entities are
rejected. File content selects the format, independent of filename. Only UTF-8,
namespace-correct GPX 1.1 is accepted. Multiple tracks/sessions remain separate;
routes and waypoints never become recorded workouts.

The API accepts bytes and optional configuration, returning a promise:

```ts
import { extractWorkoutSummary } from "@hackyeah/wearable-data";
import { workoutFileSummarySchema } from "@hackyeah/contracts/workout-file";

const result = await extractWorkoutSummary(bytes);
const validated = workoutFileSummarySchema.parse(result);
for (const activity of validated.activities) {
  const moving = activity.metrics.movingTime;
  // Show an estimate label and coverage warning when moving?.complete is false.
}
```

Each activity includes start/end time, sport/name when present, sample/segment/lap
counts, and metrics. Each metric has `value`, `unit`, `origin`, `method`,
`complete`, and optional `coverage`/`parameters`. A null value is never complete.
Metrics include distance, elapsed/timer/moving time, elevation gain, average
speed/pace, and available FIT source heart-rate/power averages. Derived distance,
moving time and gain are also returned separately from preferred source values.
Calories are outside the product scope.

Timestamps with explicit offsets normalize to UTC. Local timestamps retain their
original offset-free value and emit warnings; they cannot drive duration or speed
calculations. No timezone is inferred from the machine, user or coordinates.
Unknown sport names are retained; pace is returned only for running/walking/hiking.

### Moving time and distance

Prefer explicit FIT source moving time when present. FIT `totalTimerTime` is
reported separately and never substituted for moving time. Otherwise, derive
motion per adjacent sample interval using its left-hand recorded speed, falling
back to geodesic distance / duration. Cumulative source distance supports indoor
records. Split intervals at timer-event boundaries and exclude explicit pauses.
An absent initial timer event is treated as running.

Default movement threshold: **0.3 m/s**, or **1 m/s for cycling**. The maximum
sample gap is **30 seconds**, and the maximum accepted horizontal speed is
**100 m/s**. Equal/reversed/ambiguous timestamps, missing movement evidence,
excessive gaps and implausible speeds are excluded. Segment boundaries are never
bridged. Coverage includes evaluated, excluded and unobserved seconds; multiple
segments or insufficient sample coverage prevent a complete moving-time claim.

Distance prefers a valid FIT source total. Otherwise it sums valid within-segment
geodesic or cumulative-distance intervals. Untimed GPX geometry may produce a
partial distance estimate; no speed/gap validation is claimed for those intervals.
Average speed divides complete distance by complete timer time, falling back to
elapsed time, and declares that basis. It never uses a partial moving-time estimate.

### Elevation gain

Prefer valid FIT session ascent; retain a separate derived estimate. Derivation
uses a **3-sample median window** with preserved endpoints and **3-metre
hysteresis**: accepted uphill changes run from trough to peak, committed when a
sufficient descent starts or a run ends. Small vertical noise is ignored. Break
runs at missing elevations, time discontinuities, excessive gaps and vertical
changes above **10 m/s** when timing is available. No interpolation or terrain
lookup occurs. Observed flat runs produce zero; insufficient elevation produces
null. Coverage reports evaluated versus possible sample intervals.

These are configurable initial product heuristics, tested on synthetic fixtures.
Representative consenting device exports are still needed for real-world tuning;
results need not match Garmin Connect or another fitness platform.

### Limits and isolation

Default limits: **10 MiB input**, **250,000 FIT messages / GPX points**, **64 XML
levels**, **100 FIT sessions**, **10-second worker timeout**, and a **256 MiB
worker old-generation heap**. Configuration must be finite and positive, with
integer size/count/depth/window values and an odd elevation window. The worker
also bounds parsing time and memory; a failure discards partial output. Errors
exclude raw parser/SDK content. No original file is modified.

## Implementation and verification

The implementation adds format adapters, normalization, summary algorithms,
a worker wrapper, shared output schema and automated fixtures. No environment
variables, migrations or storage initialization are required. Build before
consuming the exported worker API:

```sh
npm ci
npm run build:wearables
npm run test:wearables
npm run typecheck --workspace=@hackyeah/contracts
npm run typecheck --workspace=@hackyeah/wearable-data
npm run lint --workspace=@hackyeah/contracts
npm run lint --workspace=@hackyeah/wearable-data
npm run format:wearables
```

Fixtures are synthetic; tests exercise binary CRC/truncation, namespace prefixes,
XML limits/entities, offset/local timestamps, indoor/multisport activities,
pauses, gaps, stationary jitter, slow walking, climbing and incomplete coverage.
No live device exports, HTTP upload flow or Expo device smoke check is claimed.
Exact final verification results are recorded below after running the checks.

Recovery: stop calling the new export; the existing importer and persisted
wearable records require no migration or rollback. One teammate approval is
required before merging, following the repository's review convention.

## References

- [Official Garmin JavaScript SDK](https://github.com/garmin/fit-javascript-sdk)
- [Garmin activity session summaries](https://developer.garmin.com/fit/articles/file-types/activity.html)
- [GPX 1.1 schema](https://www.topografix.com/gpx/1/1/)
- [Existing wearable integration](wearable-extraction.md)

Verified locally on 2026-10-04 with Node 24.19.0: locked dependency installation,
wearable/contracts builds, all **61 wearable tests** (including **23 new workout
summary cases**), root workspace typechecks, root workspace lint and wearable/
feature-document formatting pass. No HTTP, storage or mobile UI integration was
changed, so no new device smoke test was required.
