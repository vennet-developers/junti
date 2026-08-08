import { describe, expect, it } from "vitest";

import { quorumOf } from "./quorum";

describe("quorumOf", () => {
  it("reports nothing when the organizer stated no minimum", () => {
    expect(quorumOf(3, null)).toEqual({ state: "unset", missing: 0, minimum: 0 });
  });

  it("treats zero as unset, not as a floor of zero", () => {
    // Zero would be a stated policy ("it happens no matter what"), which is
    // the same as having said nothing — and there is no sentence to show.
    expect(quorumOf(0, 0).state).toBe("unset");
  });

  it("counts how many are still missing", () => {
    expect(quorumOf(4, 10)).toEqual({ state: "short", missing: 6, minimum: 10 });
  });

  it("is met exactly at the floor", () => {
    expect(quorumOf(10, 10)).toEqual({ state: "met", missing: 0, minimum: 10 });
  });

  it("stays met above the floor, never reporting a negative shortfall", () => {
    expect(quorumOf(14, 10)).toEqual({ state: "met", missing: 0, minimum: 10 });
  });

  it("counts seats rather than rows, so guests count toward the floor", () => {
    // One sponsor with three guests is four units — the same arithmetic the
    // capacity check uses, so the two can never disagree.
    expect(quorumOf(4, 4).state).toBe("met");
  });

  it("is short of everything when nobody has answered", () => {
    expect(quorumOf(0, 8)).toEqual({ state: "short", missing: 8, minimum: 8 });
  });
});
