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

/**
 * The polyline and area for a sparkline. Mirrors `@stackmyth/charts` — see
 * the note on `components/sparkline.tsx` for why the copy exists and when it
 * dies. Unlike `barGeometry` this MAY scale min-to-max: a sparkline shows
 * shape, never magnitude, and the number beside it carries the magnitude.
 */
export function sparklinePath(
  values: readonly number[],
  box: { width: number; height: number },
): { line: string; area: string } {
  if (values.length === 0) return { line: "", area: "" };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const stepX = values.length > 1 ? box.width / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = values.length > 1 ? index * stepX : box.width / 2;
    const y = span === 0 ? box.height / 2 : box.height - ((value - min) / span) * box.height;
    return `${roundTo2(x)},${roundTo2(y)}`;
  });

  const line = `M${points.join(" L")}`;
  const area = `${line} L${roundTo2(values.length > 1 ? box.width : box.width / 2)},${box.height} L0,${box.height} Z`;
  return { line, area };
}

/** The stroke recipe for a donut. Shares clamp — see the component. */
export function donutArc(
  share: number,
  radius: number,
): { circumference: number; dash: string } {
  const clamped = Math.min(1, Math.max(0, share));
  const circumference = 2 * Math.PI * radius;
  return {
    circumference,
    dash: `${roundTo2(clamped * circumference)} ${roundTo2(circumference)}`,
  };
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}
