/* Text helpers shared by the copy functions. No domain knowledge. */

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** "1 session" / "3 sessions" — the phrase the questionnaire, plan header and chat all use. */
export function sessionCountLabel(count: number): string {
  return `${count} ${pluralize(count, "session", "sessions")}`;
}

/** Seconds as the shortest readable form: "45 s", "2 min". */
export function formatSeconds(seconds: number): string {
  return seconds < 60 || seconds % 60 ? `${seconds} s` : `${seconds / 60} min`;
}

/** "Monday, Tuesday and Friday" — an and-joined list, as a sentence would read it. */
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
