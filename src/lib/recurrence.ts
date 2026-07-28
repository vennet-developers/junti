/**
 * When the next occurrence of a repeating event falls.
 *
 * Seven days added to the UTC instant, not to the local date. For a weekly
 * fixture that is the arithmetic that keeps the wall clock: the stored zone is
 * applied at render time, so a Bogotá event and a Madrid one both come out as
 * "same day next week, same time on the clock" — including across a daylight
 * saving change, where adding a local date would shift the hour.
 *
 * Pure, and used on both sides — no `server-only`.
 */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function nextWeekStart(from: Date): Date {
  return new Date(from.getTime() + WEEK_MS);
}
