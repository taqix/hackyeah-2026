/**
 * The name people are greeted by (Today, the You tab): asked at sign-up and
 * changed in Settings › Account. Stored in the Auth user's metadata and as the
 * profile's `username`. The screens and both backends share these rules.
 */
import { ApiError } from '../api/types';

export const NAME_MAX_LENGTH = 50;

export const NAME_MISSING = 'Add the name we should greet you by.';
export const NAME_TOO_LONG = `Keep it to ${NAME_MAX_LENGTH} characters or fewer.`;

/** Why a typed name can't be saved, in the app's words, or null when it can. Spaces around it don't count. */
export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return NAME_MISSING;
  // Characters as people count them: an emoji or accented letter is one.
  if (Array.from(trimmed).length > NAME_MAX_LENGTH) return NAME_TOO_LONG;
  return null;
}

/** The name as saved (trimmed); rejects an empty or too long one with `validation`. */
export function checkName(name: string): string {
  const problem = nameProblem(name);
  if (problem) throw new ApiError('validation', problem);
  return name.trim();
}
