import { describe, expect, it } from 'vitest';
import {
  MemoryWearableStore,
  WearableService,
  normalizeHealthKitSample,
  type WearableAdapter,
  type ExtractionPage,
} from '../dist/index.js';
import { sourceEventSchema } from '@hackyeah/contracts/wearables';
import { connection, event, changedEvent, range, request, now } from './fixtures.js';

async function setup() {
  const store = new MemoryWearableStore();
  const service = new WearableService(store, () => new Date(now));
  await service.registerConnection('alice', connection());
  return { store, service };
}
const page = (
  events: unknown[] = [event()],
  next_cursor: string | null = null,
): ExtractionPage => ({
  events,
  next_cursor,
  completeness: 'complete',
  empty_availability: 'no_data',
});
const adapter = (fetch: WearableAdapter['fetch']): WearableAdapter => ({
  provider: 'garmin',
  transport: 'garmin_api',
  version: 'v1',
  datasets: ['workouts'],
  fetch,
});

describe('canonical validation', () => {
  it('rejects unknown fields, mismatched kinds, negative values and missing availability', () => {
    const valid = event();
    expect(sourceEventSchema.safeParse(valid).success).toBe(true);
    expect(sourceEventSchema.safeParse({ ...valid, user_id: 'bob' }).success).toBe(false);
    expect(sourceEventSchema.safeParse({ ...valid, dataset: 'sleep' }).success).toBe(false);
    expect(sourceEventSchema.safeParse({ ...valid, operation: 'delete' }).success).toBe(false);
    expect(
      sourceEventSchema.safeParse({ ...valid, payload: { ...valid.payload, distance_meters: -1 } })
        .success,
    ).toBe(false);
    expect(
      sourceEventSchema.safeParse({
        ...valid,
        payload: { ...valid.payload, field_availability: {} },
      }).success,
    ).toBe(false);
    expect(
      sourceEventSchema.safeParse({
        ...valid,
        payload: { ...valid.payload, route: [{ lat: 50, lon: 20 }] },
      }).success,
    ).toBe(false);
  });
});

describe('transactional ingestion', () => {
  it('enforces separate HRV consent and rolls back earlier events in the same batch', async () => {
    const { service } = await setup();
    const updated = await service.updateConsent('alice', 'connection', {
      ...connection().consent,
      hrv: false,
    });
    const { payload } = normalizeHealthKitSample({
      type: 'hrv_sdnn',
      uuid: 'sdnn',
      value: 42,
      unit: 'ms',
      start_at: now,
      end_at: now,
      source_application: 'synthetic',
    });
    payload.provenance.import_mode = 'official_api';
    await expect(
      service.ingest('alice', [
        event({ connection_generation: updated.generation }),
        event({
          connection_generation: updated.generation,
          ingest_event_id: 'hrv',
          external_id: 'observation:sdnn',
          dataset: 'observations',
          payload,
        }),
      ]),
    ).rejects.toMatchObject({ code: 'consent_required' });
    expect((await service.records('alice', range)).records).toHaveLength(0);
  });
  it('defers orphan laps and cascades an ordered parent deletion', async () => {
    const { service } = await setup();
    const parent = event();
    const lap = event({
      external_id: 'workout_lap:1:1',
      ingest_event_id: 'lap',
      payload: {
        kind: 'workout_lap',
        parent_external_id: 'workout:1',
        parent_kind: 'workout',
        source_lap_id: '1',
        order: 0,
        start_at: '2026-10-02T10:00:00Z',
        end_at: '2026-10-02T10:05:00Z',
        elapsed_seconds: 300,
        timer_seconds: null,
        moving_seconds: null,
        distance_meters: 500,
        provenance: parent.payload!.provenance,
      },
    });
    await service.ingest('alice', [lap]);
    expect((await service.records('alice', range)).records).toHaveLength(0);
    await service.ingest('alice', [parent]);
    expect((await service.records('alice', range)).records).toHaveLength(2);
    await service.ingest('alice', [
      event({
        operation: 'delete',
        payload: null,
        ingest_event_id: 'delete-parent',
        source_updated_at: '2026-10-03T11:00:00Z',
      }),
    ]);
    expect((await service.records('alice', range)).records).toHaveLength(0);
    expect(
      (await service.ingest('alice', [{ ...lap, ingest_event_id: 'old-lap' }]))[0]?.outcome,
    ).toBe('stale');
  });
  it('deduplicates receipts, rejects reused keys and versions corrections', async () => {
    const { service, store } = await setup();
    const first = await service.ingest('alice', [event()]);
    expect(await service.ingest('alice', [event()])).toEqual(first);
    await expect(
      service.ingest('alice', [changedEvent({ ingest_event_id: 'event-1' })]),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect((await service.ingest('alice', [changedEvent()]))[0]?.outcome).toBe('updated');
    expect((await service.records('alice', range)).records[0]?.version).toBe(2);
    expect(await store.transaction('alice', (tx) => tx.list('revisions'))).toHaveLength(2);
  });
  it('isolates owners for reads, writes, enrollment and deletion', async () => {
    const { service } = await setup();
    await service.ingest('alice', [event()]);
    expect((await service.records('bob', range)).records).toEqual([]);
    await expect(service.ingest('bob', [event()])).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.disconnect('bob', 'connection', true)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(service.enrollAppleReader('bob', 'connection', 'phone')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
  it('keeps tombstones for unknown records and blocks delayed resurrection', async () => {
    const { service } = await setup();
    await service.ingest('alice', [
      event({ operation: 'delete', payload: null, source_updated_at: '2026-10-03T11:00:00.000Z' }),
    ]);
    expect((await service.ingest('alice', [event({ ingest_event_id: 'late' })]))[0]?.outcome).toBe(
      'stale',
    );
    expect((await service.records('alice', range)).records).toEqual([]);
  });
  it('does not compare opaque revisions or use receipt time to resolve conflicts', async () => {
    const { service } = await setup();
    await service.ingest('alice', [event({ source_updated_at: null, revision: 'z' })]);
    const result = await service.ingest('alice', [
      changedEvent({
        source_updated_at: null,
        revision: 'zzzz',
        observed_at: '2027-01-01T00:00:00Z',
      }),
    ]);
    expect(result[0]?.outcome).toBe('conflict');
    expect((await service.records('alice', range)).records[0]?.version).toBe(1);
  });
  it('advances ordering on an unchanged newer snapshot', async () => {
    const { service } = await setup();
    await service.ingest('alice', [event()]);
    await service.ingest('alice', [
      event({ ingest_event_id: 'watermark', source_updated_at: '2026-10-03T12:00:00.000Z' }),
    ]);
    expect((await service.ingest('alice', [changedEvent()]))[0]?.outcome).toBe('stale');
  });
  it('rolls back the whole transaction on consent failure', async () => {
    const { service } = await setup();
    const next = await service.updateConsent('alice', 'connection', {
      ...connection().consent,
      datasets: ['sleep'],
    });
    await expect(
      service.ingest('alice', [event({ connection_generation: next.generation })]),
    ).rejects.toMatchObject({ code: 'consent_required' });
    expect((await service.records('alice', range)).records).toEqual([]);
  });
  it('preserves identity on reconnect and fences old data after purge', async () => {
    const { service, store } = await setup();
    await service.ingest('alice', [event()]);
    await service.disconnect('alice', 'connection');
    const next = await service.reconnect('alice', 'connection');
    await service.ingest('alice', [changedEvent({ connection_generation: next.generation })]);
    expect((await service.records('alice', range)).records).toHaveLength(1);
    await service.disconnect('alice', 'connection', true);
    await expect(
      service.ingest('alice', [changedEvent({ connection_generation: next.generation })]),
    ).rejects.toMatchObject({ code: 'stale_generation' });
    expect((await service.records('alice', range)).records).toHaveLength(0);
    expect(await store.transaction('alice', (tx) => tx.list('revisions'))).toHaveLength(0);
  });
  it('uses half-open boundaries and owner-bound pagination', async () => {
    const { service } = await setup();
    await service.ingest('alice', [
      event(),
      event({ external_id: 'workout:2', ingest_event_id: 'e2' }),
    ]);
    const first = await service.records('alice', { ...range, limit: 1 });
    expect(first.next_cursor).not.toBeNull();
    const second = await service.records('alice', {
      ...range,
      limit: 1,
      after: first.next_cursor!,
    });
    expect(second.records).toHaveLength(1);
    expect(second.records[0]?.id).not.toBe(first.records[0]?.id);
    expect(
      (await service.records('alice', { ...range, start_at: '2026-10-02T10:10:00Z' })).records,
    ).toHaveLength(0);
  });
});

describe('bounded synchronization', () => {
  it('serializes provider reads and reconciles verified current-state snapshots without revision timestamps', async () => {
    const { service } = await setup();
    await service.ingest('alice', [event({ source_updated_at: null })]);
    let unblock!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const running = service.sync(
      'alice',
      request,
      adapter(async () => {
        started();
        await pending;
        return {
          ...page([changedEvent({ source_updated_at: null })]),
          authoritative_current_state: true,
        };
      }),
    );
    await entered;
    await expect(
      service.sync(
        'alice',
        { ...request, query_id: 'other' },
        adapter(async () => page()),
      ),
    ).rejects.toMatchObject({ code: 'sync_in_progress' });
    unblock();
    expect((await running).complete).toBe(true);
    expect((await service.records('alice', range)).records[0]?.version).toBe(2);
  });
  it('recovers an expired lease and rejects the old worker commit', async () => {
    let time = new Date(now);
    const service = new WearableService(new MemoryWearableStore(), () => time);
    await service.registerConnection('alice', connection());
    let unblock!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const running = service.sync(
      'alice',
      request,
      adapter(async () => {
        started();
        await pending;
        return page();
      }),
    );
    const rejected = expect(running).rejects.toMatchObject({ code: 'sync_in_progress' });
    await entered;
    time = new Date(time.getTime() + 121000);
    await service.sync(
      'alice',
      { ...request, query_id: 'recovery' },
      adapter(async () => page([changedEvent()])),
    );
    unblock();
    await rejected;
    expect((await service.records('alice', range)).records[0]?.event.ingest_event_id).toBe(
      'event-2',
    );
  });
  it('resumes committed pages after a fetch error', async () => {
    const { service } = await setup();
    let calls = 0;
    const failing = adapter(async ({ cursor }) => {
      calls += 1;
      if (cursor) throw new Error('network');
      return page([event()], 'page-2');
    });
    await expect(service.sync('alice', request, failing)).rejects.toThrow('network');
    expect(calls).toBe(2);
    const result = await service.sync(
      'alice',
      request,
      adapter(async ({ cursor }) => {
        expect(cursor).toBe('page-2');
        return page([event({ external_id: 'workout:2', ingest_event_id: 'e2' })]);
      }),
    );
    expect(result.complete).toBe(true);
    expect((await service.records('alice', range)).records).toHaveLength(2);
  });
  it('does not commit an in-flight page after disconnect', async () => {
    const { service } = await setup();
    const source = adapter(async () => {
      await service.disconnect('alice', 'connection', true);
      return page();
    });
    await expect(service.sync('alice', request, source)).rejects.toMatchObject({
      code: 'stale_generation',
    });
    expect((await service.records('alice', range)).records).toHaveLength(0);
  });
  it('keeps malformed and partial pages incomplete while saving valid records', async () => {
    const { service } = await setup();
    const result = await service.sync(
      'alice',
      request,
      adapter(async () => page([event(), { bad: true }])),
    );
    expect(result).toMatchObject({ complete: false, rejected_records: 1, availability: 'error' });
    expect((await service.records('alice', range)).records).toHaveLength(1);
    const partial = await service.sync(
      'alice',
      { ...request, query_id: 'partial' },
      adapter(async ({ cursor }) =>
        cursor ? page([]) : { ...page([], 'p2'), completeness: 'partial' },
      ),
    );
    expect(partial.complete).toBe(false);
  });
  it('rejects repeating cursors, changed adapter versions and foreign events', async () => {
    const { service } = await setup();
    await expect(
      service.sync(
        'alice',
        request,
        adapter(async () => page([], 'repeated')),
      ),
    ).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(
      service.sync('alice', request, { ...adapter(async () => page()), version: 'v2' }),
    ).rejects.toMatchObject({ code: 'schema_changed' });
    await expect(
      service.sync(
        'alice',
        { ...request, query_id: 'foreign' },
        adapter(async () => page([event({ connection_id: 'foreign' })])),
      ),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

describe('Apple batches', () => {
  async function apple() {
    const store = new MemoryWearableStore();
    const service = new WearableService(store);
    await service.registerConnection(
      'alice',
      connection({
        provider: 'apple_health',
        provider_subject: 'health-dataset',
        transport: 'native_healthkit',
      }),
    );
    const linked = await service.enrollAppleReader('alice', 'connection', 'phone');
    const sample = normalizeHealthKitSample({
      type: 'hrv_sdnn',
      uuid: 'sample-1',
      value: 0.042,
      unit: 's',
      start_at: '2026-10-02T06:00:00Z',
      end_at: '2026-10-02T06:01:00Z',
      source_application: 'com.apple.health',
    });
    const batch = {
      schema_version: '1.0',
      connection_id: linked.id,
      connection_generation: linked.generation,
      reader_epoch: linked.reader!.epoch,
      bridge_id: 'phone',
      stream_id: 'apple_health_source',
      batch_id: 'batch-1',
      batch_sequence: 1,
      created_at: now,
      events: [
        {
          operation: 'upsert',
          dataset: 'observations',
          observed_at: now,
          query_version: 'sdnn-v1',
          ...sample,
        },
      ],
    };
    return { service, batch };
  }
  it('normalizes SDNN and acknowledges immutable retries with the original result', async () => {
    const { service, batch } = await apple();
    expect(batch.events[0]?.payload).toMatchObject({ value: 42, unit: 'ms', method: 'sdnn' });
    const receipt = await service.ingestAppleBatch('alice', batch);
    expect(await service.ingestAppleBatch('alice', batch)).toEqual(receipt);
    await expect(
      service.ingestAppleBatch('alice', { ...batch, created_at: '2026-10-03T13:00:00Z' }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });
  it('rejects gaps, stale writers and direct unordered uploads', async () => {
    const { service, batch } = await apple();
    await expect(
      service.ingestAppleBatch('alice', { ...batch, batch_sequence: 2 }),
    ).rejects.toMatchObject({ code: 'sequence_gap' });
    await expect(service.enrollAppleReader('alice', 'connection', 'phone-2')).rejects.toMatchObject(
      { code: 'idempotency_conflict' },
    );
    await service.enrollAppleReader('alice', 'connection', 'phone-2', true);
    await expect(service.ingestAppleBatch('alice', batch)).rejects.toMatchObject({
      code: 'stale_generation',
    });
  });
  it('orders additions/deletes in one batch and keeps owner claims out', async () => {
    const { service, batch } = await apple();
    const removed = { ...batch.events[0], operation: 'delete', payload: null };
    await service.ingestAppleBatch('alice', { ...batch, events: [...batch.events, removed] });
    expect(
      (await service.records('alice', { ...range, dataset: 'observations' })).records,
    ).toHaveLength(0);
    await expect(
      service.ingestAppleBatch('alice', { ...batch, user_id: 'bob' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });
});
