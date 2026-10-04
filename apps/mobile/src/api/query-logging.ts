/**
 * Debug builds: React Query activity in the Metro and DevTools console.
 * Queries log a first load (`… plan.state`), each fetch that brought new data
 * or failed (`✓ plan.state 120ms object{…}`, `✕ plan.week(2026-10-05) offline`),
 * and retries; a background refetch that changed nothing stays quiet, so
 * polling is not noise. Mutations log start, success and failure by their
 * `mutationKey`. Variables and data values are never printed, only shapes.
 */
import type { Mutation, Query, QueryClient } from '@tanstack/react-query';

import { debugLog, debugWarn, describeError, errorLabel, shortenIds, startTimer, summarizeData } from '@/lib/debug-log';

/** `['plan', 'week', '2026-10-05']` → `plan.week(2026-10-05)`; IDs shortened. */
export function formatQueryKey(key: readonly unknown[] | undefined): string {
  if (!key || key.length === 0) return '(no key)';
  const parts = key.map((part) => (typeof part === 'string' ? shortenIds(part) : JSON.stringify(part) ?? String(part)));
  let named = 0;
  while (named < parts.length && /^[a-z][a-z-]*$/.test(parts[named])) named += 1;
  const name = parts.slice(0, Math.max(named, 1)).join('.');
  const args = parts.slice(Math.max(named, 1));
  return args.length ? `${name}(${args.join(',')})` : name;
}

interface FetchRecord {
  took: () => string;
  /** The data before this fetch; structural sharing keeps it identical when nothing changed. */
  before: unknown;
  initial: boolean;
}

/** Subscribes to the client's caches; returns the unsubscribe. Call only when debug logs are on. */
export function logQueryActivity(client: QueryClient): () => void {
  const fetches = new WeakMap<Query, FetchRecord>();
  const mutations = new WeakMap<Mutation<unknown, unknown, unknown, unknown>, () => string>();

  const stopQueries = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    const { query, action } = event;
    const name = () => formatQueryKey(query.queryKey);
    switch (action.type) {
      case 'fetch': {
        const initial = query.state.data === undefined;
        fetches.set(query, { took: startTimer(), before: query.state.data, initial });
        if (initial) debugLog('query', `… ${name()}`);
        return;
      }
      case 'success': {
        // setQueryData (manual) is not a fetch.
        if (action.manual) return;
        const record = fetches.get(query);
        fetches.delete(query);
        if (record && !record.initial && action.data === record.before) return;
        const changed = record && !record.initial ? ' (changed)' : '';
        debugLog('query', `✓ ${name()} ${record?.took() ?? ''}${changed}`, () => ({
          data: summarizeData(action.data),
        }));
        return;
      }
      case 'failed':
        debugWarn('query', `↻ ${name()} attempt ${action.failureCount} failed (${errorLabel(action.error)}), retrying`);
        return;
      case 'error': {
        const record = fetches.get(query);
        fetches.delete(query);
        debugWarn('query', `✕ ${name()} ${record?.took() ?? ''} ${errorLabel(action.error)}`, () =>
          describeError(action.error),
        );
        return;
      }
      default:
        return;
    }
  });

  const stopMutations = client.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    const { mutation, action } = event;
    const key = mutation.options.mutationKey;
    const name = key ? formatQueryKey(key) : `mutation#${mutation.mutationId}`;
    switch (action.type) {
      case 'pending':
        mutations.set(mutation, startTimer());
        debugLog('mutation', `→ ${name}`);
        return;
      case 'success':
        debugLog('mutation', `✓ ${name} ${mutations.get(mutation)?.() ?? ''}`, () => ({
          data: summarizeData(action.data),
        }));
        mutations.delete(mutation);
        return;
      case 'error':
        debugWarn('mutation', `✕ ${name} ${mutations.get(mutation)?.() ?? ''} ${errorLabel(action.error)}`, () =>
          describeError(action.error),
        );
        mutations.delete(mutation);
        return;
      default:
        return;
    }
  });

  return () => {
    stopQueries();
    stopMutations();
  };
}
