import { SPORT_LIBRARY } from '../../lib/sport-library';
import type { ApiClient } from '../client';
import type { SportDefinition } from '../types';
import type { RemoteContext } from './context';
import { sportFromWire } from './mappers';

/** Onboarding shows six suggested tags. */
const SUGGESTED_COUNT = 6;

const libraryIndex = (id: string) => {
  const index = SPORT_LIBRARY.findIndex((sport) => sport.slug === id);
  return index < 0 ? SPORT_LIBRARY.length : index;
};

/**
 * The catalog in the app's order: working sports first, each group in the
 * library's order, unknown sports after by name. When the catalog has none of
 * the library's suggested sports, the first six working ones are suggested.
 */
export function orderCatalog(sports: SportDefinition[]): SportDefinition[] {
  const ordered = [...sports].sort(
    (a, b) =>
      Number(a.availability === 'preview') - Number(b.availability === 'preview') ||
      libraryIndex(a.id) - libraryIndex(b.id) ||
      a.name.localeCompare(b.name),
  );
  if (ordered.some((sport) => sport.suggested)) return ordered;
  let left = SUGGESTED_COUNT;
  return ordered.map((sport) => {
    if (sport.availability !== 'working' || left === 0) return sport;
    left -= 1;
    return { ...sport, suggested: true };
  });
}

export function createRemoteCatalog(ctx: RemoteContext): ApiClient['catalog'] {
  return {
    async listSports() {
      const [sports, ids] = await Promise.all([ctx.data.sports(), ctx.data.sportIds()]);
      return orderCatalog(sports.map((sport) => sportFromWire(sport, ids.toApp)));
    },
  };
}
