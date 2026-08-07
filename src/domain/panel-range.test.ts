import { describe, expect, it } from "vitest";

import { bogotaMidnight, bucketOf, resolveRange } from "./panel-range";

/**
 * The panel's clock arithmetic. Worth pinning because every wrong answer here
 * silently filters the owner's numbers wrong — a panel that shows "ayer" as
 * the wrong twenty-four hours draws a clean picture of the wrong day.
 */

// 2026-08-06 21:30 UTC = 16:30 in Bogota.
const now = new Date("2026-08-06T21:30:00Z");

describe("bogota midnight", () => {
  it("anchors to the Bogota calendar day, not the UTC one", () => {
    // 03:00 UTC on the 7th is still 22:00 on the 6th in Bogota.
    expect(bogotaMidnight(new Date("2026-08-07T03:00:00Z"))).toEqual(
      new Date("2026-08-06T05:00:00Z"),
    );
  });
});

describe("the presets", () => {
  it("defaults to the trailing 30 days", () => {
    const range = resolveRange({}, now);
    expect(range.preset).toBe("30d");
    expect(range.days).toBe(30);
    expect(range.to).toEqual(now);
  });

  it("resolves 24h to a rolling day, not a calendar one", () => {
    const range = resolveRange({ rango: "24h" }, now);
    expect(range.from).toEqual(new Date("2026-08-05T21:30:00Z"));
    expect(range.days).toBe(1);
  });

  it("resolves ayer to the full previous Bogota day", () => {
    const range = resolveRange({ rango: "ayer" }, now);
    expect(range.from).toEqual(new Date("2026-08-05T05:00:00Z"));
    expect(range.to).toEqual(new Date("2026-08-06T05:00:00Z"));
  });

  it("resolves a custom start at Bogota midnight, ending now", () => {
    const range = resolveRange({ desde: "2026-08-01" }, now);
    expect(range.preset).toBe("custom");
    expect(range.from).toEqual(new Date("2026-08-01T05:00:00Z"));
    expect(range.to).toEqual(now);
  });

  /** A typo is not a verdict: mangled input opens the default view. */
  it("falls back to the default on garbage or a future start", () => {
    expect(resolveRange({ rango: "drop table" }, now).preset).toBe("30d");
    expect(resolveRange({ desde: "2027-01-01" }, now).preset).toBe("30d");
    expect(resolveRange({ desde: "not-a-date" }, now).preset).toBe("30d");
  });
});

describe("bucketing", () => {
  it("draws short ranges daily and the default monthly view weekly", () => {
    expect(bucketOf(resolveRange({ rango: "7d" }, now))).toBe("day");
    expect(bucketOf(resolveRange({ rango: "ayer" }, now))).toBe("day");
    expect(bucketOf(resolveRange({}, now))).toBe("week");
  });
});
