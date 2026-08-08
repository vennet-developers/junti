import { describe, expect, it } from "vitest";

import { allocate, availableOf, balanceOf, type CreditRow } from "./credits";

const t0 = new Date("2026-08-01T00:00:00Z");

function credit(over: Partial<CreditRow> & { id: string }): CreditRow {
  return {
    amountMinor: 4_333,
    appliedMinor: 0,
    currency: "COP",
    settledAt: null,
    createdAt: t0,
    ...over,
  };
}

describe("availableOf", () => {
  it("is the whole amount when untouched", () => {
    expect(availableOf(credit({ id: "a" }))).toBe(4_333);
  });

  it("subtracts what was already spent", () => {
    expect(availableOf(credit({ id: "a", appliedMinor: 1_000 }))).toBe(3_333);
  });

  it("is nothing once the organizer settled it outside the app", () => {
    expect(availableOf(credit({ id: "a", settledAt: t0 }))).toBe(0);
  });

  it("never goes negative, even on a row that was over-applied", () => {
    expect(availableOf(credit({ id: "a", appliedMinor: 9_999 }))).toBe(0);
  });
});

describe("balanceOf", () => {
  it("adds up what is still owed", () => {
    const balance = balanceOf(
      [credit({ id: "a" }), credit({ id: "b", amountMinor: 2_000 })],
      "COP",
    );
    expect(balance).toBe(6_333);
  });

  it("never mixes currencies", () => {
    // A credit earned on a peso game cannot discount a dollar one.
    const credits = [credit({ id: "a" }), credit({ id: "b", currency: "USD", amountMinor: 500 })];
    expect(balanceOf(credits, "COP")).toBe(4_333);
    expect(balanceOf(credits, "USD")).toBe(500);
  });
});

describe("allocate", () => {
  it("spends the oldest debt first", () => {
    const older = credit({ id: "older", amountMinor: 1_000, createdAt: t0 });
    const newer = credit({
      id: "newer",
      amountMinor: 1_000,
      createdAt: new Date(t0.getTime() + 60_000),
    });

    // Passed newest-first to prove the order comes from the dates, not the input.
    expect(allocate([newer, older], "COP", 1_000)).toEqual([
      { creditId: "older", amountMinor: 1_000 },
    ]);
  });

  it("splits across credits when one is not enough", () => {
    const a = credit({ id: "a", amountMinor: 1_000, createdAt: t0 });
    const b = credit({ id: "b", amountMinor: 5_000, createdAt: new Date(t0.getTime() + 60_000) });

    expect(allocate([a, b], "COP", 3_000)).toEqual([
      { creditId: "a", amountMinor: 1_000 },
      { creditId: "b", amountMinor: 2_000 },
    ]);
  });

  it("keeps the remainder of a credit bigger than the ask", () => {
    const big = credit({ id: "big", amountMinor: 10_000 });
    expect(allocate([big], "COP", 2_500)).toEqual([{ creditId: "big", amountMinor: 2_500 }]);
  });

  it("takes nothing when the ask is already covered", () => {
    expect(allocate([credit({ id: "a" })], "COP", 0)).toEqual([]);
  });

  it("ignores settled and exhausted rows", () => {
    const credits = [
      credit({ id: "settled", settledAt: t0 }),
      credit({ id: "spent", appliedMinor: 4_333 }),
      credit({ id: "live", amountMinor: 800, createdAt: new Date(t0.getTime() + 60_000) }),
    ];
    expect(allocate(credits, "COP", 5_000)).toEqual([{ creditId: "live", amountMinor: 800 }]);
  });

  it("allocates at most what is left on a partly spent credit", () => {
    const partial = credit({ id: "partial", amountMinor: 4_333, appliedMinor: 4_000 });
    expect(allocate([partial], "COP", 1_000)).toEqual([
      { creditId: "partial", amountMinor: 333 },
    ]);
  });
});
