import { describe, expect, it } from "vitest";

import { delta, projectNext30, share } from "./chart";

/**
 * The dashboard's arithmetic. Worth testing because a figure that scales
 * wrong looks completely fine — the wrong number is rendered cleanly, and the
 * person reading it decides something on it.
 *
 * The SVG geometry that used to be pinned here moved to `@stackmyth/charts`
 * with the components, and is tested there.
 */

describe("the two ratios", () => {
  it("reports change against the previous period", () => {
    expect(delta(15, 10)).toBe(50);
    expect(delta(5, 10)).toBe(-50);
  });

  /** "+100%" against a week where nothing happened is arithmetic, not news. */
  it("returns null when there is nothing to compare against", () => {
    expect(delta(5, 0)).toBeNull();
  });

  it("reports a share, or null for an empty denominator", () => {
    expect(share(1, 4)).toBe(25);
    expect(share(0, 4)).toBe(0);
    expect(share(3, 0)).toBeNull();
  });
});

describe("the 30-day projection", () => {
  const weeks = (...values: number[]) => values.map((value) => ({ value }));

  it("averages the trailing four completed weeks", () => {
    // 7 per week over four weeks → 1/day → 30 in 30 days. The trailing 99
    // is the CURRENT week and must not count.
    expect(projectNext30(weeks(7, 7, 7, 7, 99))).toBe(30);
  });

  /** A Monday must not read as a collapse. */
  it("excludes the current partial week", () => {
    expect(projectNext30(weeks(14, 14, 14, 14, 0))).toBe(60);
  });

  it("refuses to call one busy week a pace", () => {
    expect(projectNext30(weeks(0, 0, 0, 12, 3))).toBeNull();
    expect(projectNext30(weeks(5, 2))).toBeNull(); // solo una completada
  });

  it("counts quiet weeks against the pace once it exists", () => {
    // Two active + two empty completed weeks: the zeros dilute honestly.
    expect(projectNext30(weeks(14, 0, 14, 0, 1))).toBe(30);
  });
});
