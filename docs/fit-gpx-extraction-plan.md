# FIT and GPX extraction decisions

The extraction plan is now implemented in TypeScript on
`codex/fit-gpx-extraction`, based on the latest `develop` available when work
started. See [workout file summaries](features/workout-file-summary.md) for the
implementation, algorithms, default parameters, integration API and verification.

Confirmed scope: extracted data fills workout summaries; storage is deferred.
Moving time and elevation gain are included with explicit source/derived
provenance and coverage. The implementation extends the existing wearable-data
workspace and shared contracts. Raw GPS/sensor samples stay inside the temporary
parser worker, while callers receive summary metrics only.

Remaining work is application integration and real-device calibration, not a
runtime or storage decision blocking this library. No app endpoint, file picker,
persistence or deployment is part of this change.
