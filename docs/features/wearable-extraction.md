# Feature: reusable wearable extraction

Status: ready for review (library implementation; provider release gates remain)

## Outcome and scope

`@hackyeah/contracts/wearables` contains versioned runtime schemas and types that
clients can share. `@hackyeah/wearable-data` is a **server-only Node.js library**
with deterministic ingestion, normalization, adapters and storage. It does not
import React Native, NestJS or application planning/completion code. The Expo
starter and its screens are unchanged.

Implemented:

- Strict v1 workout/lap, sleep session/segment, observation, daily summary,
  provenance, connection/consent and Apple batch schemas. Required nullable fields
  stay nullable; intervals and availability are validated. Unknown fields are
  rejected rather than retained as unconsented raw data.
- `WearableService`: owner isolation, append-only consent history, generation
  fences, reconnect, optional purge, receipts, revisions, tombstones, ordered
  Apple ingestion, bounded page checkpoints, read pagination and parent deletion.
  Source identity survives reconnect. Orphan laps remain hidden until their
  parent is available. No guessed deletion from an empty/incomplete page.
- `importActivityFit`: real binary activity FIT decoding using pinned official
  Garmin SDK 21.217.0, CRC/type checks, a 10 MiB input limit, 100-session limit,
  worker memory limit and 10-second timeout. Separate elapsed/timer/moving time
  and metres. One record per session. Extracted output excludes GPS, sensors,
  serial numbers, developer fields and the original file. Wellness FIT, ZIP,
  GPX and TCX are not supported.
- `CorosMcpClient`: pinned regional HTTPS endpoint, JSON/SSE transport with matching
  JSON-RPC IDs, full catalog pagination, input/output schema validation, reviewed
  schema hashes and a hard read allowlist. Error codes are sanitized; rate limits
  expose Retry-After. Redirects, narrative output and unreviewed tools are rejected.
  `CorosAdapter` executes explicitly supplied, reviewed dataset bindings.
- `GarminAdapter`: approved API client + explicit response mapper behind the same
  bounded page contract. No guessed private API endpoints or scraping.
- `normalizeHealthKitSample`: the internal native-reader boundary for workouts,
  sleep categories, SDNN and resting HR. Converts SDNN seconds to milliseconds,
  keeps unknown sports/stages, and does not invent timer/moving duration.
  `ingestAppleBatch` validates elected reader, generation, epoch, sequential
  batch numbers and immutable retries in one storage transaction.
- `PostgresWearableStore` and its real SQL migration; `MemoryWearableStore` for
  tests/demo. Owner locks serialize transactions across reconnects. Read leases
  serialize provider calls per account/dataset and fence expired workers.
- Sleep interval union and HRV comparison-series keys. Sleep sources must be
  selected explicitly; there is no automatic cross-provider deduplication or
  mixing of HRV methods, devices or measurement windows.

## Run and use

From the repository root:

```sh
npm ci
npm run build:wearables
npm run demo:wearables
npm run test:wearables
npm run typecheck
npm run lint
npm run format:wearables
```

The demo uses synthetic FIT bytes, imports twice and prints one canonical workout.
The library uses Node.js worker threads and must not be bundled into the mobile
or browser client. Clients import only `@hackyeah/contracts/wearables`. Build
contracts before importing them; root checks handle that dependency. The typed
example is in `packages/wearable-data/examples/import-fit.ts`; running it directly
uses Node's TypeScript support (Node 24+).

### Backend boundary

```ts
import {
  WearableService,
  PostgresWearableStore,
} from "@hackyeah/wearable-data";
import type { TransactionalSql } from "@hackyeah/wearable-data";

// Supply your backend driver's real transaction boundary (example below).
declare const database: TransactionalSql;
const wearables = new WearableService(new PostgresWearableStore(database));

// authenticatedUserId must come from a verified Supabase session.
// Call registerConnection only from trusted enrollment, after verifying the
// provider subject/capabilities. It is not an unvalidated public request body.
```

An existing `pg` pool can be adapted without a NestJS dependency:

```ts
const database: TransactionalSql = {
  async transaction(run) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      const result = await run({
        async query<T>(sql: string, parameters?: unknown[]) {
          const result = await client.query(sql, parameters);
          return { rows: result.rows as T[] };
        },
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
```

Apply `supabase/migrations/20261003120000_wearable_extraction.sql` to the selected
database through the normal migration process. No hosted database has been
modified. All tables enable RLS with **no client policies**. Use a trusted backend
DB role; app users must never receive that connection or a privileged key. Every
repository operation also filters by the authenticated owner. The implementation
keeps versioned JSONB documents in dedicated wearable tables; it does not require
future product tables or expose wearable rows directly to Supabase clients.

The PostgreSQL transaction must use the same session for every query and commit
before resolving. The service acknowledges Apple batches **after application and
commit**, returning `status: applied` and equal accepted/applied sequence numbers.
This is deliberately synchronous; it does not pretend that an in-memory queue is
durable. A future HTTP ingress can add a transactional job outbox as specified in
the architecture. `MemoryWearableStore` must never back production acknowledgments.

### Adapters and scheduling

`WearableAdapter.fetch(context)` returns at most 500 candidate events, an opaque
next cursor, explicit completeness and honest empty availability. Context includes
the owner-bound connection, requested dataset/window, current cursor and abort
signal. `sync` defaults to 10 pages and accepts at most 100; windows are at most
31 days. The host schedules/retries calls using its durable job runner. It should
respect `WearableError.code` and `retry_after_seconds`; an error never advances a
page checkpoint.

Use a stable `query_id` for retries of one job, and a new ID for a new poll,
reconciliation or parser repair. Checkpoints also fence adapter-version changes.
Malformed records increment `rejected_records` and keep coverage incomplete;
valid records commit, but raw invalid payloads are not retained. Repair by
re-reading with a new query ID and fresh event IDs. A result without verified
completeness remains partial/unknown, including an earlier incomplete page.

Provider revisions are opaque. A changed digest without trusted ordering yields
`conflict`, preserving the current record. A mapper may set
`authoritative_current_state: true` **only for a reviewed current-state refetch**.
Those reads use a persisted stream sequence and a 120-second lease. Concurrent
reads return `sync_in_progress`; expired workers cannot commit. This supports
safe correction of providers without revision timestamps. Cached listings and
callbacks cannot claim that ordering. Ordinary timestamped source updates use
`source_updated_at`, never receipt time.

Construct `CorosMcpClient` for one connection and the pinned regional MCP endpoint.
Supply `getAccessToken` from the backend credential service (including serialized
refresh). Use `discover()` to inspect tools. A `CorosBinding` supplies dataset,
allowlisted tool name, a **reviewed** `toolSchemaHash`, argument builder and a
strict decoder from authorized source fixtures. Do not automatically accept a
new live hash: a schema mismatch disables that mapping. Discovery runs for each
page in this first implementation. FIT download tools are intentionally disabled
until quotas and URL handling are verified.

For Garmin, supply `GarminClient` and `GarminContract` after approved partner access.
Webhook authentication, account/generation correlation and safe current-state
refetch belong in that approved client/ingress. `ingest()` accepts **internal,
verified events**, not arbitrary webhooks or app-client bodies.

Manual FIT imports use a separate connection with `transport: manual` and
`provider_subject: manual:<backend-dataset-id>`. Pass a stable backend upload ID
and original receipt timestamp to the parser and retain the resulting events for
retry. Reusing an upload ID with changed content is rejected. Independent uploads
and later cloud records remain separate namespaces; the host can deduplicate
identical upload files before assigning another ID. File contents never establish
an authenticated Garmin/COROS account or verified manufacturer.

For Apple, enroll with `enrollAppleReader`; an explicit takeover is needed for a
second phone. Build batches matching `appleBatchSchema`, upload oldest sequence
first and use `ingestAppleBatch`. Native deletion uses the same namespaced sample
ID and a null payload. A generation/consent change requires re-enrollment; stale
queued batches cannot write. Empty native reads should remain `unknown` unless
there is positive evidence for `no_data`.

`records()` uses half-open timestamp intervals, opaque ID pagination and a maximum
of 500 results. Date-only records use the half-open source-date range from the
request's date portions; they never acquire a fabricated midnight measurement.
Only live records are returned. Read queries currently scan an owner's summary
partition; add indexed range queries before importing large sensor histories.

## Integration boundaries still to connect

This change implements the reusable layer requested for later stages. It does
not add app screens, HTTP controllers, Supabase session verification, provider
OAuth registration/refresh, periodic jobs, raw artifact storage or deployments.

- Garmin private endpoints, callback authentication and source field schemas
  still require approved access and authorized fixtures.
- COROS argument/output mappings and replication terms remain live-account gates.
  Synthetic transport tests are not evidence of a working account connection.
- The **Swift HealthKit reader, entitlements, native lifecycle observers, anchors,
  durable phone outbox and background uploads are not implemented**. The typed
  reader/batch interface and backend batch implementation are ready to connect.
  Health Auto Export has no default guessed JSON mapper.
- Native device tests, real provider refresh/revoke tests and live account sync
  have not run. Cross-provider duplicate decisions, daily/AI context, retained
  raw files, detailed sensors, quotas and retention/backup cleanup remain separate
  architecture work packages. The library never changes completion or plans.

## Verification and release

Verified locally on 2026-10-03 with Node 26.4.0: `npm ci`, library build,
38 automated tests, workspace typechecks (including Expo and test/example types),
workspace lint, formatting and `npm run demo:wearables` all pass. The demo imports
the same synthetic FIT twice and reports exactly one workout.

Automated fixtures are synthetic and contain no participant exports or credentials.
Tests cover binary FIT checks, normalization, validation, consent/owner isolation,
receipt collisions, corrections/tombstones, reconnect/purge, Apple reader/sequence
fencing, interrupted/partial paging, fetch lease recovery and MCP protocol errors.
The database suite applies the actual migration and tests commit/rollback,
concurrent retries and RLS using local PostgreSQL WASM (PGlite), not mocked SQL.

Before deployment, run the same migration on the team's disposable Supabase
instance and verify its configured backend role. No hosted deployment or device
validation is claimed. This additive migration can remain in place if the host
integration is rolled back; do not drop retained health data as an automatic
application rollback.

Primary references used for implementation: [official Garmin FIT SDK](https://github.com/garmin/fit-javascript-sdk),
[COROS gateway helper](https://github.com/coroslab/COROS-MCP/blob/main/skill/coros_mcp_login_gateway/scripts/coros_mcp_login.py),
[HealthKit SDNN](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn).
The shared architecture in `docs/data-extraction/README.md` remains authoritative
for the later production stages; this file distinguishes implemented behavior
from those planned stages.

### Storage-independent FIT/GPX workout summaries

For filling a workout log before saving it, use `extractWorkoutSummary(bytes)`.
It requires no connection or store, supports FIT activity files and GPX 1.1 tracks,
and returns per-session/track metrics including derived moving time and elevation
gain with provenance and coverage. See [workout file summaries](workout-file-summary.md)
for algorithms, limits and integration. Existing `importActivityFit` behavior and
storage contracts are unchanged.
