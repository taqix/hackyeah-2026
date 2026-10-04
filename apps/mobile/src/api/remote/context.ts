import type { RemoteData } from './data';
import type { RemoteDeps } from './deps';
import type { DraftStore } from './drafts';
import type { ProductApi } from './http';

/** What every ApiClient section of the remote adapter is built from. */
export interface RemoteContext {
  /** The product API transport (envelope, errors, retries). */
  http: ProductApi;
  /** Cached reads for the signed-in user; invalidate after writes. */
  data: RemoteData;
  deps: RemoteDeps;
  /** Logged sessions not saved to the server yet. */
  drafts: DraftStore;
}
