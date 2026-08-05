/**
 * The thresholds that decide whether Google Calendar sync gets built.
 *
 * **Written down before any data existed**, which is the whole point of them
 * being constants in a file rather than a judgement made six weeks from now
 * while looking at the numbers. A threshold chosen after seeing the result is
 * not a threshold; it is a justification.
 *
 * In `domain/` rather than beside the query in `lib/funnel.ts` because the page
 * that renders the verdict ships to the browser, and `lib/funnel.ts` imports
 * the database client — the tripwire in `scripts/check-client-bundle.mjs`
 * exists to catch exactly that mistake.
 *
 * The reasoning behind each number is in `GOOGLE-CALENDAR.md`. In short: below
 * 15% the calendar is a minority habit and sync is a large build serving few
 * people, and one download is curiosity where two is a habit — sync only pays
 * off for habits.
 */

/** Share of event-page viewers who download the file. */
export const CALENDAR_SHARE_THRESHOLD = 15;

/** Share of downloaders who come back and do it again. */
export const CALENDAR_REPEAT_THRESHOLD = 30;

/**
 * Whether a measured percentage clears its threshold.
 *
 * `null` is "not measured yet" and is deliberately NOT a failure: an empty
 * denominator means nobody has visited, which is a different statement from
 * "people visited and did not want this". Reporting it as unmet would let the
 * gate be closed by a quiet week.
 */
export function meetsGate(percent: number | null, threshold: number): boolean | null {
  if (percent === null) return null;
  return percent >= threshold;
}
