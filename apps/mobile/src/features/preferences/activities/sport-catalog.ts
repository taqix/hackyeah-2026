/** Sport catalog helpers for Activities (3.2): tag order, labels, icons and search. */
import type { SportDefinition } from '@/api/types';
import type { IconName } from '@/components/ui';
import { activityLabel, PREF_OPTIONS } from '@/lib/preference-options';

export type SportTagItem = { id: string; label: string; icon?: IconName };

/** Preview sports are shown but cannot be planned yet. */
export const PREVIEW_REASON = "We can't plan this one yet.";

const SEARCH_LIMIT = 5;

export const isPickable = (sport: SportDefinition) => sport.availability === 'working';

/** The onboarding label ("Walk", "Strength (home or gym)"), else the catalog name. */
export const sportLabel = (id: string, sports: SportDefinition[]) => activityLabel(id, sports);

const tagIcon = (id: string): IconName | undefined =>
  PREF_OPTIONS.activity_interests.find((o) => o.value === id)?.icon;

/**
 * The suggested sports, then every other picked one in catalog order, so a pick
 * from search joins the tags and can be undone there. Picks the catalog no
 * longer lists stay at the end for the same reason.
 */
export function tagSports(sports: SportDefinition[], selected: string[]): SportTagItem[] {
  const known = sports.filter((s) => s.suggested || selected.includes(s.id)).map((s) => s.id);
  const unknown = selected.filter((id) => !sports.some((s) => s.id === id));
  return [...known, ...unknown].map((id) => ({ id, label: sportLabel(id, sports), icon: tagIcon(id) }));
}

/** Matches anywhere in the name (label or catalog name), first five. */
export function searchSports(sports: SportDefinition[], query: string): SportDefinition[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return sports
    .filter((s) => s.name.toLowerCase().includes(term) || sportLabel(s.id, sports).toLowerCase().includes(term))
    .slice(0, SEARCH_LIMIT);
}
