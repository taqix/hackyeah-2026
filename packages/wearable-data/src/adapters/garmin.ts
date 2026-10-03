import type { Dataset } from '@hackyeah/contracts/wearables';
import { WearableError } from '../errors.js';
import type { ExtractionPage, FetchContext, WearableAdapter } from '../types.js';

/** Approved Garmin API client: owns exact endpoints, scopes, callback authentication and token refresh. */
export interface GarminClient {
  fetch(context: FetchContext): Promise<unknown>;
}
export interface GarminContract {
  version: string;
  datasets: readonly Dataset[];
  decode(input: unknown, context: FetchContext): ExtractionPage;
}
export class GarminAdapter implements WearableAdapter {
  readonly provider = 'garmin';
  readonly transport = 'garmin_api';
  readonly datasets: readonly Dataset[];
  readonly version: string;
  constructor(
    private readonly client: GarminClient,
    private readonly contract: GarminContract,
  ) {
    this.datasets = contract.datasets;
    this.version = contract.version;
  }
  async fetch(context: FetchContext): Promise<ExtractionPage> {
    if (!this.datasets.includes(context.request.dataset)) throw new WearableError('unsupported');
    return this.contract.decode(await this.client.fetch(context), context);
  }
}
