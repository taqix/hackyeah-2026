import type {
  Availability,
  Connection,
  Dataset,
  SourceEventV1,
  SyncRequest,
} from '@hackyeah/contracts/wearables';

export type Ordering =
  | { kind: 'source_time'; at: string }
  | { kind: 'apple_stream'; epoch: number; sequence: number; index: number }
  | { kind: 'authoritative_fetch'; stream: string; sequence: number }
  | { kind: 'unordered' };

export interface SourceRecord {
  id: string;
  user_id: string;
  provider_subject: string;
  version: number;
  fingerprint: string;
  event: SourceEventV1;
  ordering: Ordering;
  deleted_at: string | null;
}
export type IngestOutcome = 'inserted' | 'updated' | 'deleted' | 'unchanged' | 'stale' | 'conflict';
export interface EventReceipt {
  digest: string;
  record_id: string;
  outcome: IngestOutcome;
}
export interface BatchReceipt {
  digest: string;
  batch_id: string;
  connection_generation: number;
  reader_epoch: number;
  accepted_sequence: number;
  applied_sequence: number;
  status: 'applied';
  outcomes: EventReceipt[];
}
export interface Checkpoint {
  request: SyncRequest;
  cursor: string | null;
  complete: boolean;
  adapter_version: string;
  coverage: 'complete' | 'partial' | 'unknown';
  availability: Availability;
  rejected_records: number;
  committed_at: string;
}
export interface Entities {
  connections: Connection;
  records: SourceRecord;
  revisions: SourceRecord;
  receipts: EventReceipt | BatchReceipt;
  checkpoints: Checkpoint;
  consents: {
    connection_id: string;
    generation: number;
    consent: Connection['consent'];
    recorded_at: string;
  };
  leases: { token: string | null; expires_at: string; sequence: number };
}
/** All operations run inside one serializable, owner-scoped transaction. */
export interface WearableTransaction {
  get<K extends keyof Entities>(table: K, key: string): Promise<Entities[K] | null>;
  set<K extends keyof Entities>(table: K, key: string, value: Entities[K]): Promise<void>;
  list<K extends keyof Entities>(table: K): Promise<Entities[K][]>;
  remove(table: keyof Entities, key: string): Promise<void>;
}
export interface WearableStore {
  transaction<T>(owner: string, run: (tx: WearableTransaction) => Promise<T>): Promise<T>;
}

export interface FetchContext {
  connection: Connection;
  request: SyncRequest;
  cursor: string | null;
  signal?: AbortSignal;
}
export interface ExtractionPage {
  events: unknown[];
  next_cursor: string | null;
  completeness: 'complete' | 'partial' | 'unknown';
  empty_availability: Extract<Availability, 'no_data' | 'unknown'>;
  /** Only a reviewed current-state read may set this; never a historical cached listing or callback. */
  authoritative_current_state?: boolean;
}
/** External I/O produces bounded pages; only the service may persist them. */
export interface WearableAdapter {
  readonly provider: Connection['provider'];
  readonly transport: Connection['transport'];
  readonly version: string;
  readonly datasets: readonly Dataset[];
  fetch(context: FetchContext): Promise<ExtractionPage>;
}
