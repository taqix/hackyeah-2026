/**
 * FOUNDATION STUB: the data-layer work replaces this with the in-memory mock
 * backend (seeded catalog, demo persona, mock planner and coach, latency and
 * demo failure switches). Keep the export name.
 */
import type { ApiClient } from '../client';
import { ApiError } from '../types';

const notReady = () => Promise.reject(new ApiError('unknown', 'Mock API not implemented yet'));

export function createMockApiClient(): ApiClient {
  return new Proxy({} as ApiClient, {
    get: () => new Proxy({}, { get: () => notReady }),
  });
}
