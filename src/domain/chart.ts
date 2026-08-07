/**
 * The arithmetic behind the owner dashboard's NUMBERS: two ratios and a
 * projection.
 *
 * In `domain/` because a figure that scales wrong looks completely fine. A
 * roster that loses a name is obvious the moment somebody reads it; a delta
 * against the wrong window draws a clean picture of the wrong thing, and the
 * person reading it makes a decision on it.
 *
 * This file used to also hold the SVG geometry (bars, sparkline paths, donut
 * arcs) as a mirror of `@stackmyth/charts` while that package was unreleased.
 * The package shipped in 0.26.2 and the geometry died with the mirrored
 * components — it lives, tested, at the source. What stays is what is
 * Junti's: how ITS dashboard summarises ITS weeks.
 */

/**
 * How a total moved against the period before it.
 *
 * Null when there is nothing to compare against — a first period, or a
 * previous one that was empty. "+100%" against a week where nothing happened
 * is arithmetic, not news, and `Infinity` from dividing by zero renders as a
 * number nobody can act on.
 */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * A share, as a whole percentage, or null when the denominator is empty.
 *
 * The same rule the calendar gate uses: "0%" reads as a verdict and "nobody
 * has done this yet" is not one.
 */
export function share(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 100);
}

/**
 * Next 30 days at the current pace: the trailing four COMPLETED weeks
 * averaged, times 30. Deliberately not a fitted curve — with weeks of data a
 * regression is confidence theater, and "at the current pace" is the only
 * honest sentence.
 *
 * The current, partial week is excluded: it always undercounts, and would
 * drag every projection down on a Monday. Null until two completed weeks have
 * data, because one busy week is an event, not a pace.
 */
export function projectNext30(weekly: readonly { value: number }[]): number | null {
  const completed = weekly.slice(0, -1).slice(-4);
  const active = completed.filter((week) => week.value > 0);
  if (active.length < 2) return null;

  const perWeek = completed.reduce((sum, week) => sum + week.value, 0) / completed.length;
  return Math.round((perWeek / 7) * 30);
}
