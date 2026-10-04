import { randomUUID } from 'node:crypto';
import {
  appleBatchSchema,
  connectionSchema,
  consentSchema,
  sourceEventSchema,
  syncRequestSchema,
  type Connection,
  type Dataset,
  type SourceEventV1,
  type SyncRequest,
} from '@hackyeah/contracts/wearables';
import { parse, WearableError } from './errors.js';
import { digest } from './hash.js';
import type {
  BatchReceipt,
  Checkpoint,
  EventReceipt,
  Ordering,
  SourceRecord,
  WearableAdapter,
  WearableStore,
  WearableTransaction,
} from './types.js';

export function recordKey(
  connection: Connection,
  event: Pick<SourceEventV1, 'dataset' | 'external_id'>,
): string {
  return digest([
    connection.user_id,
    connection.provider,
    connection.provider_subject,
    event.dataset,
    event.external_id,
  ]);
}
const receiptKey = (event: SourceEventV1) =>
  digest([event.connection_id, event.connection_generation, event.ingest_event_id]);
const checkpointKey = (request: SyncRequest) => digest(request);
function ordering(event: SourceEventV1): Ordering {
  return event.source_updated_at
    ? { kind: 'source_time', at: event.source_updated_at }
    : { kind: 'unordered' };
}
function compareOrder(incoming: Ordering, current: Ordering): number | null {
  if (incoming.kind === 'authoritative_fetch') {
    if (current.kind === 'authoritative_fetch')
      return incoming.stream === current.stream ? incoming.sequence - current.sequence : null;
    return 1; // A leased, verified current-state read reconciles previously unordered deliveries.
  }
  if (incoming.kind === 'source_time' && current.kind === 'source_time')
    return Date.parse(incoming.at) - Date.parse(current.at);
  if (incoming.kind === 'apple_stream' && current.kind === 'apple_stream') {
    return (
      incoming.epoch - current.epoch ||
      incoming.sequence - current.sequence ||
      incoming.index - current.index
    );
  }
  return null;
}
function checkEnabled(connection: Connection, generation: number, dataset?: Dataset) {
  if (connection.state !== 'active' || connection.generation !== generation)
    throw new WearableError('stale_generation');
  if (dataset) {
    if (!connection.consent.datasets.includes(dataset)) throw new WearableError('consent_required');
    if (connection.capabilities[dataset]?.availability !== 'available')
      throw new WearableError('unsupported');
  }
}

export class WearableService {
  constructor(
    private readonly store: WearableStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Trusted backend boundary: owner comes from a verified app session; subject/capabilities from verified enrollment. */
  async registerConnection(owner: string, input: unknown): Promise<Connection> {
    const connection = parse(connectionSchema, input);
    if (connection.user_id !== owner) throw new WearableError('not_found');
    const transportProvider = {
      garmin_api: 'garmin',
      coros_mcp: 'coros',
      native_healthkit: 'apple_health',
      export_bridge: 'apple_health',
    };
    if (
      connection.transport !== 'manual' &&
      transportProvider[connection.transport] !== connection.provider
    )
      throw new WearableError('invalid_input');
    if (connection.transport === 'manual' && !connection.provider_subject.startsWith('manual:'))
      throw new WearableError('invalid_input');
    return this.store.transaction(owner, async (tx) => {
      const existing = await tx.list('connections');
      if (
        existing.some(
          (c) =>
            c.id === connection.id ||
            (c.provider === connection.provider &&
              c.provider_subject === connection.provider_subject),
        )
      ) {
        throw new WearableError('idempotency_conflict');
      }
      await tx.set('connections', connection.id, connection);
      await this.saveConsent(tx, connection);
      return connection;
    });
  }

  async connections(owner: string): Promise<Connection[]> {
    return this.store.transaction(owner, (tx) => tx.list('connections'));
  }

  async updateConsent(owner: string, connectionId: string, input: unknown): Promise<Connection> {
    const consent = parse(consentSchema, input);
    return this.store.transaction(owner, async (tx) => {
      const connection = await this.connection(tx, connectionId);
      connection.consent = consent;
      connection.generation += 1;
      connection.reader = null;
      await tx.set('connections', connectionId, connection);
      await this.saveConsent(tx, connection);
      return connection;
    });
  }

  /** Call after re-verifying the same provider subject. Credentials belong to the host app. */
  async reconnect(owner: string, connectionId: string): Promise<Connection> {
    return this.store.transaction(owner, async (tx) => {
      const connection = await this.connection(tx, connectionId);
      connection.generation += 1;
      connection.state = 'active';
      connection.reader = null;
      await tx.set('connections', connectionId, connection);
      return connection;
    });
  }

  async disconnect(owner: string, connectionId: string, deleteImportedData = false): Promise<void> {
    await this.store.transaction(owner, async (tx) => {
      const connection = await this.connection(tx, connectionId);
      connection.generation += 1;
      connection.state = 'disconnected';
      connection.reader = null;
      await tx.set('connections', connectionId, connection);
      if (deleteImportedData) {
        for (const table of ['records', 'revisions'] as const) {
          for (const record of await tx.list(table)) {
            if (
              record.event.provider === connection.provider &&
              record.provider_subject === connection.provider_subject
            ) {
              await tx.remove(
                table,
                table === 'records' ? record.id : `${record.id}:${record.version}`,
              );
            }
          }
        }
      }
    });
  }

  async ingest(owner: string, inputs: unknown[]): Promise<EventReceipt[]> {
    if (inputs.length > 500) throw new WearableError('too_large');
    const events = inputs.map((input) => parse(sourceEventSchema, input));
    return this.store.transaction(owner, async (tx) => {
      const output: EventReceipt[] = [];
      for (const event of events) output.push(await this.apply(tx, event, ordering(event)));
      return output;
    });
  }

  async enrollAppleReader(
    owner: string,
    connectionId: string,
    bridgeId: string,
    takeOver = false,
  ): Promise<Connection> {
    if (!bridgeId || bridgeId.length > 256) throw new WearableError('invalid_input');
    return this.store.transaction(owner, async (tx) => {
      const connection = await this.connection(tx, connectionId);
      checkEnabled(connection, connection.generation);
      if (connection.transport !== 'native_healthkit') throw new WearableError('unsupported');
      if (connection.reader?.bridge_id === bridgeId) return connection;
      if (connection.reader && !takeOver) throw new WearableError('idempotency_conflict');
      // Generation also fences an old reader when consent previously cleared reader metadata.
      connection.generation += 1;
      connection.reader = { bridge_id: bridgeId, epoch: connection.generation, sequence: 0 };
      await tx.set('connections', connectionId, connection);
      return connection;
    });
  }

  async ingestAppleBatch(owner: string, input: unknown): Promise<BatchReceipt> {
    if (Buffer.byteLength(JSON.stringify(input) ?? '') > 5 * 1024 * 1024)
      throw new WearableError('too_large');
    const batch = parse(appleBatchSchema, input);
    return this.store.transaction(owner, async (tx) => {
      const connection = await this.connection(tx, batch.connection_id);
      checkEnabled(connection, batch.connection_generation);
      const reader = connection.reader;
      if (
        connection.transport !== 'native_healthkit' ||
        !reader ||
        reader.bridge_id !== batch.bridge_id ||
        reader.epoch !== batch.reader_epoch
      ) {
        throw new WearableError('stale_generation');
      }
      const key = digest([
        'apple_batch',
        batch.connection_id,
        batch.connection_generation,
        batch.batch_id,
      ]);
      const fingerprint = digest(batch);
      const previous = await tx.get('receipts', key);
      if (previous) {
        if (previous.digest !== fingerprint || !('batch_id' in previous))
          throw new WearableError('idempotency_conflict');
        return previous;
      }
      if (batch.batch_sequence !== reader.sequence + 1) throw new WearableError('sequence_gap');
      const outcomes: EventReceipt[] = [];
      for (const [index, event] of batch.events.entries()) {
        if (event.payload && event.payload.provenance.import_mode !== 'native_healthkit')
          throw new WearableError('invalid_input');
        const normalized = parse(sourceEventSchema, {
          schema_version: '1.0',
          connection_id: connection.id,
          connection_generation: connection.generation,
          provider: 'apple_health',
          ingest_event_id: digest([batch.batch_id, index]),
          operation: event.operation,
          dataset: event.dataset,
          external_id: event.external_id,
          observed_at: event.observed_at,
          payload: event.payload,
          raw_object_ref: null,
          revision: null,
          source_updated_at: null,
        });
        outcomes.push(
          await this.apply(tx, normalized, {
            kind: 'apple_stream',
            epoch: reader.epoch,
            sequence: batch.batch_sequence,
            index,
          }),
        );
      }
      reader.sequence = batch.batch_sequence;
      await tx.set('connections', connection.id, connection);
      const receipt: BatchReceipt = {
        digest: fingerprint,
        batch_id: batch.batch_id,
        connection_generation: connection.generation,
        reader_epoch: reader.epoch,
        accepted_sequence: reader.sequence,
        applied_sequence: reader.sequence,
        status: 'applied',
        outcomes,
      };
      await tx.set('receipts', key, receipt);
      return receipt;
    });
  }

  /** Run once per durable host job. Only committed pages advance the checkpoint. */
  async sync(
    owner: string,
    input: unknown,
    adapter: WearableAdapter,
    options: { max_pages?: number; signal?: AbortSignal } = {},
  ): Promise<Checkpoint> {
    const request = parse(syncRequestSchema, input);
    const maxPages = options.max_pages ?? 10;
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100)
      throw new WearableError('invalid_input');
    const key = checkpointKey(request);
    const seen = new Set<string>();
    let result: Checkpoint | null = null;
    for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
      options.signal?.throwIfAborted();
      const { connection, checkpoint } = await this.store.transaction(owner, async (tx) => ({
        connection: await this.connection(tx, request.connection_id),
        checkpoint: await tx.get('checkpoints', key),
      }));
      checkEnabled(connection, request.connection_generation, request.dataset);
      if (
        adapter.provider !== connection.provider ||
        adapter.transport !== connection.transport ||
        !adapter.datasets.includes(request.dataset)
      )
        throw new WearableError('unsupported');
      if (checkpoint && checkpoint.adapter_version !== adapter.version)
        throw new WearableError('schema_changed');
      if (checkpoint?.complete) return checkpoint;
      const cursor = checkpoint?.cursor ?? null;
      if (cursor !== null && seen.has(cursor)) throw new WearableError('invalid_response');
      if (cursor !== null) seen.add(cursor);
      const stream = digest([connection.provider, connection.provider_subject, request.dataset]);
      const token = randomUUID();
      const lease = await this.store.transaction(owner, async (tx) => {
        checkEnabled(
          await this.connection(tx, connection.id),
          request.connection_generation,
          request.dataset,
        );
        const previous = await tx.get('leases', stream);
        if (previous?.token && previous.expires_at > this.now().toISOString())
          throw new WearableError('sync_in_progress', 30);
        const next = {
          token,
          sequence: (previous?.sequence ?? 0) + 1,
          expires_at: new Date(this.now().getTime() + 120000).toISOString(),
        };
        await tx.set('leases', stream, next);
        return next;
      });
      try {
        const page = await adapter.fetch({ connection, request, cursor, signal: options.signal });
        if (
          !Array.isArray(page.events) ||
          page.events.length > 500 ||
          !['complete', 'partial', 'unknown'].includes(page.completeness) ||
          !['unknown', 'no_data'].includes(page.empty_availability) ||
          (page.next_cursor !== null &&
            (typeof page.next_cursor !== 'string' ||
              !page.next_cursor ||
              page.next_cursor === cursor ||
              seen.has(page.next_cursor)))
        ) {
          throw new WearableError('invalid_response');
        }
        let rejected = 0;
        const valid: SourceEventV1[] = [];
        for (const event of page.events) {
          const parsed = sourceEventSchema.safeParse(event);
          if (!parsed.success) {
            rejected += 1;
            continue;
          }
          if (
            parsed.data.connection_id !== connection.id ||
            parsed.data.connection_generation !== connection.generation ||
            parsed.data.provider !== connection.provider ||
            parsed.data.dataset !== request.dataset
          ) {
            throw new WearableError('invalid_response');
          }
          valid.push(parsed.data);
        }
        result = await this.store.transaction(owner, async (tx) => {
          const current = await this.connection(tx, connection.id);
          checkEnabled(current, request.connection_generation, request.dataset);
          const activeLease = await tx.get('leases', stream);
          if (activeLease?.token !== token || activeLease.expires_at <= this.now().toISOString())
            throw new WearableError('sync_in_progress', 0);
          const before = await tx.get('checkpoints', key);
          if (digest(before) !== digest(checkpoint))
            throw new WearableError('idempotency_conflict');
          for (const event of valid) {
            const order: Ordering =
              page.authoritative_current_state === true
                ? { kind: 'authoritative_fetch', stream, sequence: lease.sequence }
                : ordering(event);
            const receipt = await this.apply(tx, event, order);
            if (receipt.outcome === 'conflict') rejected += 1;
          }
          const failures = (before?.rejected_records ?? 0) + rejected;
          const coverage =
            before?.coverage === 'partial' || page.completeness === 'partial'
              ? 'partial'
              : before?.coverage === 'unknown' || page.completeness === 'unknown'
                ? 'unknown'
                : 'complete';
          const next: Checkpoint = {
            request,
            cursor: page.next_cursor,
            adapter_version: adapter.version,
            coverage,
            complete: page.next_cursor === null && coverage === 'complete' && failures === 0,
            availability: failures
              ? 'error'
              : valid.length || before?.availability === 'available'
                ? 'available'
                : page.empty_availability,
            rejected_records: failures,
            committed_at: this.now().toISOString(),
          };
          await tx.set('checkpoints', key, next);
          return next;
        });
        if (page.next_cursor === null) return result;
      } finally {
        await this.store.transaction(owner, async (tx) => {
          const active = await tx.get('leases', stream);
          if (active?.token === token) await tx.set('leases', stream, { ...active, token: null });
        });
      }
    }
    return result!;
  }

  async records(
    owner: string,
    input: { dataset: Dataset; start_at: string; end_at: string; limit?: number; after?: string },
  ): Promise<{ records: SourceRecord[]; next_cursor: string | null }> {
    const { start_at, end_at, dataset } = parse(syncRequestSchema, {
      connection_id: 'read',
      connection_generation: 1,
      query_id: 'read',
      dataset: input.dataset,
      start_at: input.start_at,
      end_at: input.end_at,
    });
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new WearableError('invalid_input');
    return this.store.transaction(owner, async (tx) => {
      const allRecords = await tx.list('records');
      const records = allRecords
        .filter((record) => {
          if (
            record.deleted_at ||
            record.event.dataset !== dataset ||
            (input.after && record.id <= input.after)
          )
            return false;
          const payload = record.event.payload;
          if (!payload) return false;
          if (
            payload.kind === 'workout_lap' &&
            !allRecords.some(
              (parent) =>
                !parent.deleted_at &&
                parent.event.provider === record.event.provider &&
                parent.provider_subject === record.provider_subject &&
                parent.event.external_id === payload.parent_external_id,
            )
          )
            return false;
          // Date-only records keep their own source day; never invent an instant or server timezone.
          if (!('start_at' in payload) || !payload.start_at) {
            return (
              'source_local_date' in payload &&
              payload.source_local_date !== null &&
              payload.source_local_date >= start_at.slice(0, 10) &&
              payload.source_local_date < end_at.slice(0, 10)
            );
          }
          return (
            payload.start_at < end_at &&
            (payload.end_at
              ? payload.end_at > start_at || payload.start_at === start_at
              : payload.start_at >= start_at)
          );
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      return {
        records: records.slice(0, limit),
        next_cursor: records.length > limit ? records[limit - 1]!.id : null,
      };
    });
  }

  private async connection(tx: WearableTransaction, id: string): Promise<Connection> {
    const connection = await tx.get('connections', id);
    if (!connection) throw new WearableError('not_found');
    return connection;
  }
  private saveConsent(tx: WearableTransaction, connection: Connection) {
    return tx.set('consents', randomUUID(), {
      connection_id: connection.id,
      generation: connection.generation,
      consent: connection.consent,
      recorded_at: this.now().toISOString(),
    });
  }

  private async apply(
    tx: WearableTransaction,
    event: SourceEventV1,
    order: Ordering,
  ): Promise<EventReceipt> {
    const connection = await this.connection(tx, event.connection_id);
    checkEnabled(connection, event.connection_generation, event.dataset);
    if (connection.provider !== event.provider) throw new WearableError('invalid_input');
    if (connection.transport === 'native_healthkit' && order.kind !== 'apple_stream')
      throw new WearableError('invalid_input');
    const payload = event.payload;
    if (payload) {
      const mode = {
        manual: 'manual',
        garmin_api: 'official_api',
        coros_mcp: 'official_mcp',
        native_healthkit: 'native_healthkit',
        export_bridge: 'export_bridge',
      }[connection.transport];
      if (payload.provenance.import_mode !== mode) throw new WearableError('invalid_input');
      if (
        'metric' in payload &&
        (/hrv|heart.?rate.?variability/i.test(payload.metric) ||
          ('method' in payload && ['sdnn', 'rmssd'].includes(payload.method))) &&
        !connection.consent.hrv
      )
        throw new WearableError('consent_required');
      if (
        (payload.kind === 'workout_lap' ||
          (payload.kind === 'observation' &&
            payload.metric === 'heart_rate' &&
            payload.aggregation === 'source_sample')) &&
        !connection.consent.detailed_sensors
      )
        throw new WearableError('consent_required');
    }
    const key = receiptKey(event);
    const eventDigest = digest(event);
    const previous = await tx.get('receipts', key);
    if (previous) {
      if (previous.digest !== eventDigest || !('record_id' in previous))
        throw new WearableError('idempotency_conflict');
      return previous;
    }
    const id = recordKey(connection, event);
    const current = await tx.get('records', id);
    const fingerprint = digest({ operation: event.operation, payload });
    const comparison = current ? compareOrder(order, current.ordering) : null;
    let outcome: EventReceipt['outcome'];
    if (current && comparison !== null && comparison < 0) outcome = 'stale';
    else if (current?.fingerprint === fingerprint) outcome = 'unchanged';
    else if (current && (comparison === null || comparison === 0)) outcome = 'conflict';
    else outcome = event.operation === 'delete' ? 'deleted' : current ? 'updated' : 'inserted';
    if (outcome === 'unchanged' && current && comparison !== null && comparison > 0) {
      // An unchanged later snapshot still raises the watermark against delayed corrections.
      current.ordering = order;
      current.event = event;
      await tx.set('records', id, current);
    }
    if (outcome === 'inserted' || outcome === 'updated' || outcome === 'deleted') {
      const record: SourceRecord = {
        id,
        user_id: connection.user_id,
        provider_subject: connection.provider_subject,
        version: (current?.version ?? 0) + 1,
        fingerprint,
        event,
        ordering: order,
        deleted_at: event.operation === 'delete' ? this.now().toISOString() : null,
      };
      await tx.set('records', id, record);
      await tx.set('revisions', `${id}:${record.version}`, record);
      if (event.operation === 'delete' && event.external_id.startsWith('workout:')) {
        for (const child of await tx.list('records')) {
          if (
            child.event.provider === event.provider &&
            child.provider_subject === connection.provider_subject &&
            child.event.payload?.kind === 'workout_lap' &&
            child.event.payload.parent_external_id === event.external_id
          ) {
            child.deleted_at = record.deleted_at;
            child.event = { ...child.event, operation: 'delete', payload: null };
            child.ordering = order;
            child.fingerprint = digest({ operation: 'delete', payload: null });
            child.version += 1;
            await tx.set('records', child.id, child);
            await tx.set('revisions', `${child.id}:${child.version}`, child);
          }
        }
      }
    }
    const receipt: EventReceipt = { digest: eventDigest, record_id: id, outcome };
    await tx.set('receipts', key, receipt);
    return receipt;
  }
}
