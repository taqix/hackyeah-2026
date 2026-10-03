/** The phone's IANA time zone, or `fallback` when the engine can't tell. */
export function deviceTimeZone(fallback: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

/** 'Europe/Warsaw' → 'Warsaw', 'America/New_York' → 'New York', 'UTC' stays. */
export function timeZoneCity(timeZone: string): string {
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replace(/_/g, ' ');
}
