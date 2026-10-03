# COROS data extraction specification

Status: implementation design; provider contract validation is pending. Last researched: **2026-10-03**. Owner: COROS adapter. Read [the shared architecture](./README.md) for the canonical envelope, database, security, retention and operational rules. This document adds COROS behavior without changing that contract.

## 1. Decision and scope

Build a backend adapter that reads authorized COROS account data through the official MCP endpoint, schedules deterministic extraction jobs, and writes the shared ingestion envelope. No language model is required to select tools, poll, parse responses or download FIT files. Keep MCP access inside the integration worker; app features read stored canonical data.

**Proposed release order:** workout summaries, daily sleep summaries and overnight HRV first; then laps and optional raw FIT files; then optional daily heart-rate summaries. Continuous stress, wellness checks, proprietary fitness/recovery scores, menstrual data, training plans and writes are outside the initial release. Feature flags gate each dataset independently.

The app supports beginner participation and feedback as described in the [product scope](../product.md). Imported activities can provide context and user-visible history. They do not establish enjoyment, automatically complete an app-planned session, alter the user's chosen frequency/duration, or authorize an increase in intensity based on HRV. A user must explicitly confirm any association with their planned movement and provide their own feedback.

## 2. Evidence and access

Labels used throughout:

- **Documented:** present in the cited official source; this is evidence, not a successful integration test or an uptime guarantee.
- **Proposed:** our chosen architecture or default, configurable without implying a provider requirement.
- **Gate:** a fact or contract that must be verified before enabling the affected feature.

### 2.1 Access choices

| Route | Documented access and delivery | Use in this project |
| --- | --- | --- |
| Official MCP | Self-service OAuth; each user authorizes their own account; endpoint `https://mcp.coros.com/mcp`; polling; no webhook delivery. | Prototype and first adapter, subject to the bulk extraction clarification below. |
| Partner API | Requires an established platform, demonstrated users and a registered company. OAuth credentials, workout push approximately five minutes after availability, daily health data and FIT downloads; published limit 1,000 calls/minute. | Later production option when eligibility and private API contract are confirmed. |
| Manual FIT import | Project fallback, through the shared file importer. | Historical workouts or temporary provider outages; does not supply sleep/HRV. |

The MCP access facts come from [Build on COROS MCP](https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP), updated 2026-09-02. Partner facts come from [Partner API Access](https://support.coros.com/hc/en-us/articles/53181766856724-Partner-API-Access), updated 2026-09-03. Both were checked 2026-10-03.

**Contract ambiguity:** the Help Center also says COROS-to-platform activity synchronization requires Partner API, while the official MCP catalog exposes completed-activity reads and FIT retrieval. This design treats authorized reads as documented capabilities and makes unattended bulk mirroring, persistent storage and production deployment through MCP an explicit terms/access gate. Do not interpret the presence of tools as a guarantee of unrestricted replication. Get clarification from COROS before making that product promise. [Help Center limitations](https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP), [official catalog](https://github.com/coroslab/COROS-MCP#tool-list).

### 2.2 Read capability allowlist

| Dataset | Official MCP tools | Initial mapping |
| --- | --- | --- |
| Completed activities | `querySportRecords`, `getActivityDetail` | Workout summary; native sport code retained. |
| Laps | `queryActivityLapData` | Ordered lap records. |
| Raw workout file | `downloadActivityFitFiles`, `queryActivityFitFileDownloadUrls` | Private FIT artifact; parser output and route optional. |
| Sleep | `querySleepData` | Main sleep, naps, score, stage ratios and reported window. Stage intervals only if actually returned. |
| Overnight HRV | `querySleepHrv` | Official average/assessment/range; curve separately. |
| Daily health and heart rate | `queryDailyHealthData`, `queryAvgHeartRate`, `queryRestingHeartRate` | Daily summaries/observations. |

Tool names and these categories are documented in the [official catalog](https://github.com/coroslab/COROS-MCP#tool-list), checked 2026-10-03. The live, authorized `tools/list` schema controls exact argument names, field types, query limits and output formats. Do not invent a `startDate`, cursor, stable account ID, deletion endpoint or output JSON schema from a tool name. Do not call analysis or write tools as part of extraction. Treat newly added tools as disabled until reviewed.

**Dependency:** the watch must sync through the COROS app/cloud before the adapter can receive its records. Poll frequency cannot shorten the watch-to-cloud delay. [Official troubleshooting](https://github.com/coroslab/COROS-MCP#faq), checked 2026-10-03.

## 3. Components and stored state

Use the common Postgres + queue + private object-storage architecture. Add two transport implementations behind one COROS mapping module: `coros_mcp` initially and `coros_partner` later. Do not expose provider credentials to app clients, other adapters, AI prompts or general query APIs.

| Component | Responsibility |
| --- | --- |
| Connection service | User-scoped OAuth start/callback; consent groups; lifecycle and generation fences. |
| COROS auth client | Issuer discovery, client registration, code exchange and serialized refresh. |
| MCP transport | Initialization, tool discovery/call, transport and tool error handling. |
| Contract registry | Reviewed tool schema hash and explicit field mapping per issuer/version. |
| Scheduler | Per-connection/dataset jobs, fairness, overlap queries, backfill and quota reservations. |
| Extractor | Fetch bounded results; filter to app consent; persist permitted evidence; emit normalizable records. |
| Normalizer | Validate time/units/identity, create revisions, derive canonical envelopes. |
| FIT worker | Retrieve allowed files; validate/parse under resource limits. |
| Reconciler | Refresh revisable sleep/HRV and recent activities; report coverage. |

Persist these COROS-specific fields with the shared connection record:

- `transport`: `coros_mcp` or `coros_partner`; `issuer` and pinned `mcp_url`.
- `provider_subject`: opaque account identity verified from an identity response; never the app user's email or the OAuth client ID. If no reliable account ID is available, account matching on reconnect remains a gate and requires a safe explicit account choice.
- Encrypted token-set reference, client-registration reference, expiry and granted scopes; no token in a job payload.
- Consent revision and enabled datasets, schema hash and accepted mapping version.
- Per-dataset requested coverage, complete coverage intervals, next poll time, last successful receipt time, last provider event time and errors.
- Per-file retrieval ledger, quota reservation counts and returned quota/reset information if supplied.

Each queued job contains only `connection_id`, `connection_generation`, dataset, bounded requested window, mapping version, priority and retry count. Use the shared job kinds `fetch_recent`, `backfill`, `fetch_workout_detail`, `reconcile_window`, `process_event`, `rebuild_daily_view`, `disconnect` and `purge`; COROS tool/metric selection is adapter configuration. Shared dataset names are `workouts`, `sleep`, `observations` and `daily_summaries`. Laps belong to their workout; FIT is a private `file_artifacts` child, not a new event dataset. Derive `user_id` and `provider_subject` from the authenticated connection. Before external calls and before final commits, require connection state `active`, current consent and generation. Retained records use stable `user_id + provider + provider_subject + dataset + external_id` identity so a reconnect does not duplicate them. Preserve namespace prefixes when different record kinds share a dataset and their provider IDs could collide.

## 4. OAuth and MCP contract

### 4.1 Verified reference behavior

The [official helper source](https://github.com/coroslab/COROS-MCP/blob/main/skill/coros_mcp_login_gateway/scripts/coros_mcp_login.py) demonstrates gateway discovery through `/.well-known/openid-configuration` and regional issuer pinning; registration at `/connect/register`; authorization at `/oauth2/authorize`; token exchange/refresh at `/oauth2/token`; PKCE S256; scopes `openid offline_access mcp.tools`; authorization `resource` set to the regional MCP URL; public-client registration; and refresh-token use. These are reference implementation observations, checked 2026-10-03, not a published fixed SLA. HTTPS app redirect acceptance, read-only scopes and revocation must be tested.

The helper uses Streamable HTTP POST, JSON-RPC 2.0, `initialize`, `tools/list`, `tools/call`, bearer authentication and JSON/SSE responses. Its initialization advertises protocol version `2025-06-18`; tool discovery follows `nextCursor`. The current [official gateway documentation](https://github.com/coroslab/COROS-MCP/blob/main/skill/coros_mcp_login_gateway/SKILL.md#notes) describes stateless operation without `Mcp-Session-Id` or an initialized notification. Negotiate and verify the deployed contract before choosing an SDK; a generic client may need a COROS-specific compatibility layer.

Live public metadata was not accessible through the research browser. No account was connected. Protected-resource discovery, live registration policy and actual tool output remain untested.

### 4.2 Proposed production authorization flow

1. Authenticate the app user; create a one-time OAuth attempt with a 10-minute expiry, random `state`, PKCE verifier and exact HTTPS callback. Tie it to the user/session and intended connection generation.
2. Discover the gateway issuer and validate it against the reviewed COROS issuer allowlist. Known region hosts are CN/EU/US; use the discovered account route, not the user's current location or Warsaw timezone. Pin the accepted issuer for the entire attempt.
3. Retrieve and validate authorization-server metadata; compare any advertised endpoints with the approved contract. If metadata or resource-discovery behavior differs, stop with a configuration error rather than sending secrets to a guessed URL. Accept only HTTPS and reviewed COROS origins. Do not forward tokens across unvalidated redirects.
4. Register a named app client through the supported registration mechanism; store registration metadata. Use an approved server-owned registration if supported. Determine whether registration is per application, per region or per authorizing platform user; the helper's per-login registration is not a product recommendation.
5. Send the browser to the provider's authorization screen. Request the minimal verified scopes needed for enabled datasets and offline polling. Since the reference broad tool scope may include writes, enforce a hard backend read allowlist even if a separate read scope is unavailable.
6. On callback, check session, attempt expiry, exact redirect, `state`, issuer and single-use status; exchange the code with its original verifier/client. Reject account switching and mismatched issuer responses.
7. Validate token type, returned expiry and granted scopes. An `openid` scope alone is not evidence of a valid subject; if an ID token is returned, validate signature, issuer, audience and nonce under the actual OIDC contract. Otherwise use a reviewed account-identity response.
8. Store the encrypted token set atomically; delete temporary code/verifier data. Move the shared connection state from `pending_authorization` to `active`; discover tools and run a bounded smoke query before queuing backfill. Connection/capability gates are separate from dataset availability.

This application never requests or stores the COROS password. The reference helper's local CLI login-session mechanism is not part of this web-app design.

### 4.3 Proposed token lifecycle

- Encrypt access/refresh tokens and registration secrets with the shared key-management service. Store expiry, scope and issuer as operational metadata; redact credentials, codes, signed URLs and PKCE material from logs.
- Refresh on demand shortly before expiry; use a lock per connection/token family. Re-read the token revision after acquiring the lock to avoid double refresh. Persist rotated refresh/access tokens and the new token revision in one transaction.
- Honor actual returned expiry; do not assume a one-hour token. Verify refresh rotation, lifetime and whether an omitted refresh token means reuse under the provider contract.
- Treat `invalid_grant` or confirmed revocation as shared state `reauth_required`; disable only an affected capability if the credential is valid but a dataset scope is missing. Transient refresh failures must not erase a still-valid refresh token, but a lost response after possible provider-side rotation requires recovery evidence or reauthorization rather than blind reuse.
- A resource 401 gets at most one refresh-and-retry under the lock. Repeated 401 stops polling. A 403 does not trigger an infinite refresh loop: mark the affected capability `restricted` and expose a clear connection action.

### 4.4 Proposed MCP execution and schema review

Initialize the pinned endpoint, validate the negotiated version/capabilities, collect every `tools/list` page, and retain a redacted catalog hash. Resolve approved tool names to explicit dataset mappings. Cache reviewed schemas for 24 hours and refresh on reconnect, unknown-tool/argument errors or deployment change. Discovery TTL is our policy, not the provider helper's local-cache default.

Call only allowlisted reads with machine-built arguments validated against the accepted input schema. Parse structured content when available and apply field/purpose consent before retaining any source response. A JSON string in a text content block must pass a strict reviewed parser. Broad daily/profile responses must discard unconsented health categories, location, identifiers and free-text fields before the permitted payload reaches object storage, quarantine or logs. Narrative analysis text is not an ingestion schema; if only prose is returned, mark the capability unavailable for deterministic ingestion until a structured contract is confirmed. Retain only minimally permitted evidence of that failure.

Validate HTTP success, matching JSON-RPC ID, absence of JSON-RPC error, MCP `isError`, expected content type and per-record validity independently. Parse SSE completely and match the response ID; never adopt the last arbitrary event. Unknown fields are retained in raw data only when their category and purpose are explicitly consented; unclassifiable fields are discarded and never silently become canonical measurements. A schema change disables the affected mapper and alerts operators; other datasets continue.

## 5. Automatic extraction strategy

### 5.1 Initial backfill

**COROS-specific proposed initial cap:** import the last seven source-local days first, then offer 30 days of workout/sleep/HRV history. Workouts may expand toward the shared 90-day target only after verifying MCP lookback/completeness and available budget; health remains capped at the shared 30-day default. This conservative COROS cap is an explicit override of the shared workout target, not a provider limit. MCP history limits are not fully specified in public documentation.

1. Get the accepted schemas and resolve account identity/timezone behavior.
2. Set a backfill cutoff once; record the user-requested interval.
3. Split into seven-day windows initially, and shrink to each tool's stricter accepted limit. Use explicit date bounds rather than an ambiguous “recent days” mode.
4. Enumerate activities newest first. Import summaries immediately; queue details/laps only for new or changed IDs. Fetch FIT only when the user enabled raw training data or the summary mapper needs verified missing fields.
5. Query sleep and overnight HRV separately for the same source dates. Preserve naps and overnight sessions across midnight. If only daily stage ratios exist, create summary metrics without invented segments.
6. Record per-window/per-dataset coverage only after all required pages and records commit. Show partial history when quotas, lookback, permissions or malformed records prevent completion.
7. Let routine recent-data polling continue at higher priority while history completes.

Do not apply the Partner API's documented three-month lookback or 30-day request window to MCP. The [Partner API summary](https://support.coros.com/hc/en-us/articles/53181766856724-Partner-API-Access#api-reference) specifically gives those limits for `getWorkoutRecords`; partner implementation must confirm boundary semantics and any extended-history option.

### 5.2 Incremental and revision schedule

All frequencies below are **proposed defaults**, not COROS guarantees. Every query also obeys the discovered limit, consent, quota and connection state.

| Job | Default frequency/window | Reason |
| --- | --- | --- |
| Recent activity enumeration | Every 60 minutes with ±15-minute jitter; previous 72 hours plus today in source-date semantics. | Discover new activities and late syncs. |
| User-requested refresh | Debounced, at most once per connection per five minutes; same recent window. | An explicit freshness action without duplicate jobs. |
| Sleep/overnight HRV | At 09:00 and 13:00 in the user's display timezone; previous three source dates. | Most users sync after waking; timestamps still use provider provenance. |
| Nightly recent reconciliation | At 03:00 display timezone; previous seven source dates, chunked. | Revisit revised/late sleep and recently edited activities. |
| Wider reconciliation | Weekly; previous 30 source dates, chunked. | Catch older edits and gaps within verified lookback. |
| Optional daily HR/steps | Once daily with sleep reconciliation. | Context without unnecessary dense polling. |
| FIT enrichment | After a new/changed activity, within reserved budget. | Full samples only when enabled/needed. |

The user's display timezone is a scheduling preference, not evidence of the timezone attached to source records. Travel and unknown account timezone may require adjacent source-date queries. Respect DST when choosing the next local run; jitter and deduplicate jobs so the same logical run executes once.

Do not derive a global cursor from the maximum activity timestamp. An old workout can appear after a late cloud sync. Store completed coverage intervals and revision fingerprints; overlap queries and reconciliation catch such records. A tool returning a historical fallback must be dated from its actual returned event time and must never be relabelled as today.

### 5.3 Pagination and incomplete windows

Tool-catalog pagination and activity-result pagination are distinct contracts. Follow an activity cursor/page token only if its accepted schema and response define it. Preserve its connection, query filter, interval and mapping hash; reject repeated cursors and conflicting pages. Never assume `tools/list.nextCursor` also applies to tool data.

If a result declares truncation or reaches a verified count cap, recursively split the date/time window if the tool permits. Deduplicate overlapping boundary records by source ID. If the smallest supported window is still incomplete and no cursor exists, report `coverage_incomplete` and stop; do not claim a complete backfill. A response with no explicit completeness signal remains `completeness: unknown` until the contract or tested bound establishes otherwise.

Store valid records from a partial response with their provenance, but do not advance complete-coverage checkpoints. Retry the missing partition. Do not convert a timeout, malformed response or missing page to an empty successful dataset.

### 5.4 Quotas and fairness

The release article describes 50 FIT requests per calendar day; the later README describes a shared 50-file allowance for direct/URL retrieval per fixed 24-hour window. These statements differ. [Release history](https://www.coros.com/stories/coros-metrics/c/mcp-testing), [current FIT FAQ](https://github.com/coroslab/COROS-MCP#9-can-coros-mcp-retrieve-fit-files), checked 2026-10-03. Confirm reset, counting, batching and account/client scope before enabling large backfills.

**Proposed conservative rule:** cap at 40 reserved file retrievals per known platform-user account in any rolling 24 hours, retaining 10 requests as headroom. If a provider reports a stricter remaining/reset limit, obey it. A multi-file request reserves one allowance for each requested file. Retrieving a URL counts as retrieval; never retry the binary tool immediately after a successful URL request merely to obtain the same file. Reserve uncertain timeout calls until a confirmed reset so an ambiguous call cannot cause overspend.

Prioritize user-requested/new files over historical files. Backfill downloads at most 20 files per rolling 24 hours and the remainder remains queued. Share quota ledgers across reconnects, workers and any connections proven to represent the same account; resetting a generation does not reset provider allowances.

The MCP's general request-rate limit is not documented in the examined public material. Start with one active request per connection, a configurable shared semaphore per issuer, and fair round-robin scheduling with a proposed limit of 20 tool calls per minute per connection. Load-test only with authorized accounts and within confirmed terms. Budget includes initialization/discovery, retries and enrichment; prioritize latest sleep/workout data over optional datasets. Partner's published 1,000 calls/minute must not be inherited by MCP.

## 6. Identity, mapping and provenance

### 6.1 Mapping rules

| Canonical target | Mapping rule |
| --- | --- |
| Workout | Preserve the provider activity ID as an opaque string; use returned start/end and explicit unit conversion. Keep sport code + mapped sport + mapper version. |
| Lap | Parent activity source ID + provider lap ID when available; otherwise stable sequence identity only after confirming repeat ordering. Retain timing/distance units. |
| Sleep session | Use provider session ID if available. Otherwise synthetic identity uses account + source date + main/nap type + verified stable session index; retain raw IDs and identity strategy. A mutable start/end must not be the only identity key. |
| Sleep segment | Store actual stage intervals only. Retain provider stage code; map unknown stages to `unknown`. Ratio/duration totals do not establish exact stage timing. |
| Daily summary | Account + source local date + metric family; date meaning preserved. |
| HRV observation | Metric method, source context, aggregation/window, original unit and timestamp provenance required. Keep overnight average, curve, wellness-check and proprietary assessment distinct. |
| FIT artifact | Provider activity ID + content hash, private object reference, parser version; optional derived sample set/route. |

All canonical values retain provider, subject, native record ID, mapping version, receipt time, raw reference and provider update/revision only when supplied. Use shared `provenance.adapter_version`, `import_mode: official_mcp` initially (`official_api` for Partner API), original timestamp/offset, source device/application when verified, transformation version and selected source record/version references. Fingerprint the consent-filtered source representation and record its sanitization version; compare fingerprints only under equivalent filtering rules. Keep the canonical transformation version separate: a parser correction can change canonical output without establishing a provider revision. Never fabricate `source_updated_at` from receipt time. Without a reliable source revision/time, serialize fetches for the source stream and refetch current state for conflicting deliveries; old retained payload replay cannot overwrite a newer source state.

COROS documents overnight measurements in ten-minute intervals and an assessment after establishing a five-night baseline. These facts do not guarantee complete exported curves or identify every payload's statistic/unit. [Overnight HRV](https://support.coros.com/hc/en-us/articles/20959044334612-Overnight-HRV), checked 2026-10-03. Wellness Check documentation identifies RMSSD for its raw HRV; verify the overnight output's method independently before assigning that label. [Wellness Check](https://support.coros.com/hc/en-us/articles/22933466501012-Wellness-Check), checked 2026-10-03.

When method/window is unverified but the source value/unit is valid, retain the unknown provenance and keep its provider series separate. If the unit itself is unknown, keep only a consented provider-native source record pending validation; do not create a canonical HRV measurement, whose shared unit is milliseconds. Do not convert RMSSD into Apple Health SDNN or infer raw HRV from a proprietary score. Do not recompute an official overnight average from an incomplete curve and present it as the provider's value.

Store timestamps in UTC alongside original source timestamp, offset/timezone and source local date. A date-only record remains a daily observation; it is not a midnight point measurement. If timestamp units or timezone cannot be resolved, quarantine affected temporal fields and retain the daily value with explicit unknown timing. Do not assume epoch milliseconds from numeric magnitude without a contract.

No measurement is zero merely because the user did not wear the device, lacks a baseline, denied access or the provider returned nothing. Use the common availability states `available`, `no_data`, `unsupported`, `unknown`, `restricted`, `error` separately from `fresh`, `stale`, `unknown` freshness. A successful transport response does not make old source data fresh.

### 6.2 Illustrative normalized envelope

This is a synthetic fixture, **not a COROS response schema**. The production mapper must substitute verified source fields; the app backend derives ownership from `connection_id`.

```json
{
  "schema_version": "1.0",
  "ingest_event_id": "fixture-event-01",
  "connection_id": "fixture-coros-connection",
  "connection_generation": 3,
  "provider": "coros",
  "dataset": "workouts",
  "external_id": "workout:example-source-activity-id",
  "operation": "upsert",
  "observed_at": "2026-10-03T10:00:00Z",
  "source_updated_at": null,
  "revision": null,
  "raw_object_ref": "private-fixture-reference",
  "payload": {
    "kind": "workout",
    "start_at": "2026-10-03T07:00:00Z",
    "end_at": "2026-10-03T07:10:00Z",
    "source_timezone": "Europe/Warsaw",
    "source_utc_offset_seconds": 7200,
    "source_sport": "fixture-walk-code",
    "normalized_sport": "walking",
    "elapsed_seconds": 600,
    "timer_seconds": null,
    "moving_seconds": null,
    "distance_meters": 850,
    "field_availability": {
      "elapsed_seconds": "available",
      "timer_seconds": "unknown",
      "moving_seconds": "unknown",
      "distance_meters": "available"
    },
    "provenance": {
      "adapter_version": "coros-workout-v1",
      "transform_version": "workout-v1",
      "import_mode": "official_mcp",
      "source_identifiers": {
        "activity_id": "example-source-activity-id"
      },
      "timezone_origin": "synthetic_fixture"
    }
  }
}
```

An overnight HRV source fixture would additionally carry `metric_namespace: coros.sleep_hrv`, verified unit (or explicitly unknown pending validation), `method: unknown` when unconfirmed, `context: sleep`, provider date, provider average when supplied, aggregation/window provenance and nullable baseline/range. Canonical `observations` use `metric: hrv`, `unit: ms`, `start_at`, `end_at` and explicit provenance only after valid source units/time are established. Unknown method remains a distinct source series; unknown unit blocks that canonical transform. The actual payload schema must match the shared model's implemented version; these examples specify semantics rather than silently defining database columns.

### 6.3 Duplicates, revisions and deletion

- Deduplicate activities by verified source identity. Raw-object or canonical payload hashes are revisions of that record, not new workouts. Same timestamps/distance alone are insufficient identity.
- A workout exported through both COROS and Apple Health remains two source records. The shared cross-provider matcher can link them to one display event with reversible evidence, preserving each source. It must not discard distinct walks solely because their times overlap.
- Reimporting a changed daily sleep/HRV result replaces the appropriate current revision and regenerates affected summaries. It does not append a second night. Session identity changes require an explicit reconciliation strategy and tests.
- Public MCP documentation examined here does not establish source deletion events or a reliable deletion feed. Missing results never emit deletion automatically: they can mean quota, permission, retention, changed query bounds or incomplete results. Mark records pending reconciliation if absence is observed in a proven complete window; delete only with a verified authoritative deletion signal/contract or explicit app user deletion.
- Persist an explicit user-deletion suppression record with minimal opaque identity where lawful/necessary to prevent later overlap polls recreating deleted records. Delete sensitive raw content, artifacts and derived values under the common deletion workflow.

## 7. FIT retrieval and processing

### 7.1 Proposed file flow

1. Confirm the user enabled the required detail fields and the activity ID is owned by this connection. Full-file retention requires explicit consent for precise location and every included data category; detail consent alone does not authorize storing a full FIT file. Avoid requesting FIT when its contents cannot be processed within the granted purpose.
2. Check cache/ledger: use an existing immutable artifact when unchanged. Reserve quota before requesting either retrieval tool.
3. Inspect the actual tool response. It may contain a file entity or download link; the public sources do not establish its exact MIME encoding, URL host allowlist, signature scheme, authentication requirement or expiry. Validate those in the contract spike before enabling downloads.
4. If a download link is returned, treat it as a bearer secret whether or not its signature is visible. Fetch it only with the reviewed host/HTTPS/redirect/SSRF policy. Do not send the OAuth bearer token to object-storage hosts unless the verified contract requires it. Never log or expose the URL to the AI or browser.
5. Stream to encrypted bounded temporary storage with a proposed 50 MiB file bound, timeout and content hash. Full-file storage is staged privately only when every included category is consented; otherwise parse transiently, retain permitted extracted fields and delete the original. An original FIT is never retained merely because the UI hides its coordinates. If legitimate activities exceed the reviewed bound, raise it explicitly; expired URL reissue consumes quota unless the provider confirms otherwise.
6. Verify FIT signature/header and CRC through the selected parser; reject HTML/login/error pages even when HTTP status is 200. Isolate parsing with memory/time/record limits. Keep unknown fields only in an original artifact authorized by included-data consent; otherwise discard them after transient processing. Corrupt/unclassifiable files cannot be retained under summary-only consent.
7. Normalize samples and laps only from supported definitions, track parser version and retain source activity association. Omit GPS/location and unconsented sensor fields from extracted results, source objects, quarantine and derived values. Derived workout summaries can remain without a route or original file.
8. Commit permitted artifact/derived provenance, delete unretained temporary bytes and mark extraction complete. A failed parse must not invalidate an already imported valid summary. Recheck generation/consent before publishing staged objects; clean orphaned staging on retries or purge.

Training file extraction does not guarantee a route for an indoor activity or every sensor channel for every model. Missing channels remain absent. Do not synthesize second-by-second values from summary data. Permitted retained originals/source payloads expire after the shared 30-day default; canonical records and derived views default to 365 days by measurement time, both configurable and subject to explicit consent/provider terms. Keep the retention coverage boundary so weekly reconciliation does not refill expired history. Retained metadata never promises a download after the original expires; re-extraction must satisfy current consent, lookback and budget.

## 8. Reliability, health and lifecycle

### 8.1 Error policy

| Failure | Proposed action |
| --- | --- |
| 429 or provider quota error | Honor `Retry-After`/reset when verified; otherwise exponential backoff with full jitter. Update the quota ledger; keep history queued. |
| Timeout, network failure, 5xx | Use shared bounded backoff, 30 seconds to six hours with jitter and at most eight attempts before attention/dead-letter. Honor quota reset. FIT uncertainty retains its reservation; lost rotating-token response follows the auth recovery rule. |
| 401 | One synchronized refresh then retry; repeated failure requires reconnect. |
| 403 | Record dataset restriction; do not guess permissions or retry credentials endlessly. |
| Invalid arguments/tool missing/schema change | Refresh discovery once; disable affected mapping if incompatible; retain raw evidence and alert. |
| Partial/malformed record | Quarantine that record; retain valid siblings and mark incomplete coverage. |
| Storage/commit failure | Retry through shared ingestion idempotency; do not advance checkpoints. |
| Confirmed disconnection/revocation | Fence all jobs, stop scheduling and refresh, remove credentials. |

Use a circuit breaker per issuer for shared outages and per connection for persistent credential failures. UI status distinguishes “waiting for watch sync”, last successful fetch, actual latest source timestamp, backfill incomplete and reconnect required. Do not promise exact unattended latency until measured against real cloud sync behavior.

### 8.2 Operational targets and metrics

**Proposed service target:** once a record is visible to the authorized tool, routine activity ingestion should complete within two hours when the connection is healthy and budgets permit. This is our measurable target and excludes provider/device latency; it is not a provider SLA. Morning sleep ingestion should be retried through the afternoon and the nightly revision run.

Monitor tool latency/error rate by issuer/tool/schema version, source-to-receipt lag where source timing is known, polling lag, coverage holes, queued backfill age, remaining FIT reservations, token-refresh outcome, parse quarantine count, duplicate/revision count, generation-fenced jobs and deletion completion. Logs contain opaque internal connection IDs; never include medical values, notes, routes, birth dates, tokens or signed links. Aggregate metrics must not identify users.

### 8.3 Disconnect and privacy

Present separate consent for workouts, sleep, HRV, detailed sensor data, precise location and backend AI use. Backend AI consent is a separate purpose; only selected minimal derived context may reach the model, and no full FIT files or opaque provider responses do. Avoid querying profile birthday/gender, menstrual history, broad wellness checks or stress curves unless a later product feature needs and explicitly requests them. Filter even consented queries' unexpected/unconsented response fields before durable storage. The actual provider authorization screen can be broader than our extraction allowlist; describe requested access accurately.

Disconnect increments the connection generation and atomically stops new work, cancels queued work, deletes token material and catalog/account caches, and invalidates download jobs. If a verified provider revocation endpoint exists, call it; otherwise instruct users how to revoke in provider controls and do not claim server-side revocation succeeded. Local credential deletion still ends this app's access.

Keep historical data only under the user's stated retention choice. “Disconnect and delete” also deletes canonical records, all raw responses/FIT files/route objects, quarantine records, derived summaries and AI caches referencing them; an audit entry contains no health values. In-flight jobs recheck generation before raw persistence and final commit so late responses cannot recreate deleted data. Apply the shared 24-hour live-cleanup target, maximum 30-day backup expiry and restore deletion manifest, and exclude health values from monitoring/training defaults.

### 8.4 Shared application routes

COROS uses the shared app endpoints, not a separate provider-shaped public API:

| Shared route | COROS behavior |
| --- | --- |
| `POST /v1/source-connections/coros/authorize` | Start the user-bound OAuth transaction. |
| `GET /v1/source-connections/coros/callback` | Verify state, exchange code, establish source identity and `active` connection. |
| `PATCH /v1/source-connections/{id}/consent` | Update datasets/purposes; fence invalidated jobs and clean newly disallowed fields. |
| `POST /v1/source-connections/{id}/sync` | Coalesce an owner-authorized bounded `fetch_recent`; return `202` with job ID. |
| `GET /v1/source-connections` / `GET /v1/sync-jobs/{id}` | Report connection state and actual dataset/window coverage. |
| `GET /v1/workouts`, `/v1/sleep`, `/v1/observations`, `/v1/daily-context` | Serve permitted stored data/provenance under owner filters. |
| `DELETE /v1/source-connections/{id}` | Synchronously fence ingestion; queue disconnect/optional purge with explicit `delete_imported_data`. |
| `DELETE /v1/imported-data` | Purge selected scope and stop relevant reimport under the shared contract. |

No COROS MCP webhook endpoint exists. A Partner API ingress will be added only after its contract is approved. All signed artifact requests and reads enforce owner plus current purpose; shared health-response cache rules apply.

## 9. Partner API progression

Apply after the platform meets the published eligibility requirements. The transport implementation needs the actual partner docs/credentials and approved redirect/webhook endpoints. Do not invent Partner API base URLs, event names, signatures or field schemas from the Help Center's endpoint-category table.

**Proposed migration:** retain provider subject/source IDs and canonical records; add `coros_partner` as a second transport under an explicit migration state. Verify identity equivalence, compare a bounded period of MCP/partner outputs, then switch scheduling. Never double import or reset account quota simply because the transport changes.

For partner push, authenticate the documented delivery mechanism and validate it before responding. The public summary mentions client credentials in webhook headers; the final contract must establish exact names, comparison/rotation, replay handling and payload limits. Durably persist an inbox record before acknowledging; queue normalization and optional FIT retrieval afterward. Confirm retries, acknowledgment codes, event ID, update/delete behavior and whether health data has push or requires daily polling. Periodic reconciliation remains necessary.

Confirmed partner limits should be enforced at their actual scope, with shared fairness and headroom. The published approximate five-minute push is an expectation, not an end-to-end UI guarantee. The eligible backfill is bounded by the partner's verified query contract; retained MCP history is not automatically discarded when switching.

## 10. Implementation gates and acceptance tests

### 10.1 Contract spike gates

Before implementation or release, document the answer, official contract and redacted fixture for each gate:

1. **MCP usage rights:** persistent extraction, storage, unattended polling and public app operation clarified against the sync limitation.
2. **OAuth:** regional discovery, registration scope/lifetime, HTTPS callbacks, code/resource requirements, granted scopes, account identity, expiry/rotation and revocation; no account or password sharing.
3. **Transport:** protocol negotiation, stateless behavior and SDK compatibility, JSON/SSE payloads, complete tool-catalog pages and schema hashing.
4. **Data contracts:** exact argument/output schema for each allowlisted tool, historical range and inclusive/exclusive bounds, record caps/pagination/completeness, stable IDs/revisions, timestamp units/timezone and deletion semantics.
5. **Sleep/HRV:** main/nap IDs, cross-midnight date convention, actual stages vs ratios, raw curve sampling/completeness, metric method/unit/aggregation and baseline availability.
6. **FIT:** shared quota identity/reset/counting rules, batching semantics, binary/URL encoding, authentication, URL expiry/host allowlist and permitted storage/route processing.
7. **Automatic operation:** expired-token refresh works with the browser/app closed; late sync and old activity discovery measured; no assertion of exact real-time delivery.
8. **Partner:** eligibility and signed access agreement; actual endpoint/webhook/field contract before switching transport.

A missing gate disables the corresponding feature; it does not block useful summaries from other verified datasets. User-visible history reports actual available coverage.

### 10.2 Required verification suite

| Scenario | Acceptance criterion |
| --- | --- |
| OAuth state/issuer/account mismatch | Reject with no connected state or stored usable token. |
| Two workers refresh one rotating token | One refresh succeeds; every worker uses the new revision; no token loss. |
| All tool-catalog pages + changed schema | All accepted reads discovered; write tools rejected; changed mapper fenced. |
| HTTP 200 with JSON-RPC error, `isError` or HTML | No successful checkpoint or canonical bogus record. |
| Multi-event SSE | Match the expected response ID and validate full response. |
| Duplicate list page/retry/reconnect | One canonical activity identity; revised payload creates a revision. |
| More records than cap | Split/follow verified pagination; incomplete smallest window stays incomplete. |
| Late sync with old timestamp | Reconciliation imports without relying on a maximum-time cursor. |
| Revised overnight sleep and nap | One revised main session and distinct verified nap; no invented stage intervals. |
| DST/travel/date-only records | UTC conversion only when supported; original date/offset preserved; schedule executes once. |
| HRV missing unit/method/baseline | Unknown/null provenance; no zero, SDNN conversion or intensity increase. |
| Quota shared by URL/binary/reconnect | Atomic reservation; no double retrieval or reset through reconnect; history yields to new records. |
| Expired URL/invalid FIT/oversized artifact | Bounded safe failure; summary retained; secrets absent from logs. |
| FIT contains location or unconsented sensors | Parse transiently; store only permitted fields; original/temporary file deleted, including on crash cleanup. |
| Broad daily response or AI purpose disabled | Unconsented fields never reach raw storage/quarantine or AI context. |
| Source disappears from incomplete response | No fabricated delete event. |
| Disconnect/deletion while response in flight | No late credentials/raw/canonical data recreated; derived artifacts removed. |
| COROS + Apple duplicate source activity | Preserve both provenance records; any display linking remains reversible. |
| Imported workout overlaps app plan | No automatic planned completion or enjoyment feedback. |

Use synthetic/unit fixtures for deterministic mapping, contract fixtures captured only with explicit account consent, and a small authorized device test for automatic polling/refresh. Do not create tests by guessing provider payloads and then treating passing tests as contract evidence.

## 11. Delivery checklist

- [ ] COROS contract gates recorded and launch flags assigned.
- [ ] Connection/auth schema and migration conform to the shared architecture.
- [ ] Token refresh and generation fencing verified under concurrency.
- [ ] Reviewed schemas captured; structured mappers and source identity/time semantics implemented.
- [ ] Summary/sleep/HRV backfill and reconciliation report honest coverage.
- [ ] FIT budget/download/parser feature independently verified and opt-in.
- [ ] Raw field filtering/full-FIT included-data consent and AI-purpose checks verified before durable storage/use.
- [ ] Availability, freshness and reconnect UI states wired to real facts.
- [ ] End-to-end deletion covers raw, canonical, derived and in-flight data.
- [ ] Beginner product rules have regression coverage.
- [ ] Operational targets measured with real cloud-visible records.

## 12. Primary sources

All sources below were read for this specification on **2026-10-03**. Recheck live schemas and vendor terms at implementation time; the research did not authorize an account, register a client, or exercise tools.

- [Build on COROS MCP](https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP) — OAuth access route and limitations; updated 2026-09-02.
- [Partner API Access](https://support.coros.com/hc/en-us/articles/53181766856724-Partner-API-Access) — eligibility and public partner feature/limit summary; updated 2026-09-03.
- [Official COROS MCP repository/catalog](https://github.com/coroslab/COROS-MCP) — published tools and current FIT allowance description.
- [Official login helper](https://github.com/coroslab/COROS-MCP/blob/main/skill/coros_mcp_login_gateway/scripts/coros_mcp_login.py) — OAuth/discovery and transport reference implementation, inspected as source evidence.
- [Official gateway documentation](https://github.com/coroslab/COROS-MCP/blob/main/skill/coros_mcp_login_gateway/SKILL.md) — current stateless behavior and regional routing, inspected as documentation evidence.
- [Official changelog](https://github.com/coroslab/COROS-MCP/blob/main/CHANGELOG.md) — 2026-09-21 contract-documentation corrections; live catalogs can differ.
- [COROS Official MCP release history](https://www.coros.com/stories/coros-metrics/c/mcp-testing) — health/workout expansion and earlier calendar-day FIT limit wording.
- [Overnight HRV](https://support.coros.com/hc/en-us/articles/20959044334612-Overnight-HRV) — overnight sampling/baseline context.
- [Wellness Check](https://support.coros.com/hc/en-us/articles/22933466501012-Wellness-Check) — distinct spot-check RMSSD context.
