import { describe, expect, it } from "vitest";

import { barGeometry, delta, integerTicks, share } from "./chart";

/**
 * The dashboard's arithmetic. Worth testing because a chart that scales wrong
 * looks completely fine — the wrong picture is drawn cleanly, and the person
 * reading it decides something on it.
 */

const BOX = { width: 100, height: 100, gap: 10 };

describe("bar geometry", () => {
  it("scales the tallest bar to the full height, from a zero baseline", () => {
    const { bars, max } = barGeometry(
      [
        { label: "a", value: 5 },
        { label: "b", value: 10 },
      ],
      BOX,
    );

    expect(max).toBe(10);
    expect(bars[1]).toMatchObject({ height: 100, y: 0 });
    // Half the value is half the height — zero-based, never min-based.
    expect(bars[0]).toMatchObject({ height: 50, y: 50 });
  });

  it("keeps an empty week as a zero-height bar, not a missing one", () => {
    const { bars } = barGeometry(
      [
        { label: "quiet", value: 0 },
        { label: "busy", value: 4 },
      ],
      BOX,
    );

    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ height: 0, y: 100 });
  });

  /** Gaps live BETWEEN bars: one fewer than there are bars. */
  it("fills the box exactly, with no phantom final gap", () => {
    const { bars } = barGeometry(
      [
        { label: "a", value: 1 },
        { label: "b", value: 1 },
        { label: "c", value: 1 },
      ],
      BOX,
    );

    const last = bars[2]!;
    expect(last.x + last.width).toBeCloseTo(BOX.width);
  });

  it("returns no bars for an all-zero series, so the caller shows an empty state", () => {
    expect(barGeometry([{ label: "a", value: 0 }], BOX).bars).toEqual([]);
    expect(barGeometry([], BOX).bars).toEqual([]);
  });
});

describe("integer ticks", () => {
  it("counts by ones while the maximum is small", () => {
    expect(integerTicks(3)).toEqual([0, 1, 2, 3]);
  });

  it("steps up so large maxima stay at five labels or fewer", () => {
    const ticks = integerTicks(1000);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(1000);
  });

  /** The top gridline must exist even when the step does not land on it. */
  it("always includes the maximum", () => {
    expect(integerTicks(7)).toContain(7);
    expect(integerTicks(11)).toContain(11);
  });

  it("is empty at zero, matching the geometry's empty state", () => {
    expect(integerTicks(0)).toEqual([]);
  });
});

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
