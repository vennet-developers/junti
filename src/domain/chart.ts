/**
 * The arithmetic behind the owner dashboard: bar geometry and two ratios.
 *
 * In `domain/` because a chart that scales wrong looks completely fine. A
 * roster that loses a name is obvious the moment somebody reads it; a bar
 * with a truncated axis draws a clean picture of the wrong thing, and the
 * person reading it makes a decision on it.
 *
 * No chart library, and that is a conclusion rather than a preference:
 * `@tanstack/charts` 0.6.5 was tried and hung the server render four separate
 * ways (imported from `src/routes/`, behind `React.lazy`, behind a dynamic
 * import, and via its own tick options) and froze the browser at hydration.
 * Bars in a box are sixty lines; the library was none of them.
 */

export interface Point {
  /** What the bucket is called. Rendered as the axis label. */
  label: string;
  value: number;
}

export interface Bar extends Point {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bars for a series, scaled to fill the box.
 *
 * **The axis always starts at zero.** Scaling between minimum and maximum
 * makes 98 and 100 look like nothing and everything, which is the most common
 * way a chart lies.
 *
 * **A week with no data is a zero-height bar, not a missing one.** The query
 * hands over a continuous series for exactly this reason; a flat run of zeros
 * is information.
 *
 * Returns no bars for an all-zero series rather than dividing by zero — the
 * caller shows an empty state instead.
 */
export function barGeometry(
  points: readonly Point[],
  box: { width: number; height: number; gap: number },
): { bars: Bar[]; max: number } {
  const max = points.reduce((top, point) => Math.max(top, point.value), 0);
  if (points.length === 0 || max === 0) return { bars: [], max: 0 };

  // Gaps live BETWEEN bars: one fewer than there are bars. Reserving one per
  // bar leaves a margin that reads as a missing final week.
  const width = (box.width - box.gap * (points.length - 1)) / points.length;

  return {
    max,
    bars: points.map((point, index) => {
      const height = (point.value / max) * box.height;
      return {
        ...point,
        width,
        height,
        x: index * (width + box.gap),
        // SVG's origin is top-left, so a bar grows upward by starting lower.
        y: box.height - height,
      };
    }),
  };
}

/**
 * The y-axis ticks: whole numbers, at most five, always including the top.
 *
 * These charts count people and events, so a tick at 0.4 is meaningless. With
 * a small maximum the step is 1 and the axis simply counts; with a large one
 * the step rounds up so the count never exceeds five labels.
 */
export function integerTicks(max: number): number[] {
  if (max <= 0) return [];
  const step = Math.max(1, Math.ceil(max / 4));
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

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
