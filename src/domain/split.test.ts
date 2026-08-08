import { describe, expect, it } from "vitest";

import { computeSplit, evenShares, type SplitParticipant } from "./split";
import type { Attendance, PaymentStatus } from "./types";

/** Fixed base time so join order is explicit and the tests never touch the clock. */
const T0 = new Date("2026-03-01T18:00:00.000Z").getTime();

function participant(
  id: string,
  options: {
    minutesAfter?: number;
    attendance?: Attendance;
    payment?: { status: PaymentStatus; amountMinor: number } | null;
  } = {},
): SplitParticipant {
  return {
    id,
    joinedAt: new Date(T0 + (options.minutesAfter ?? 0) * 60_000),
    attendance: options.attendance ?? "in",
    payment: options.payment ?? null,
  };
}

/** Join order a, b, c, … one minute apart. */
function roster(ids: string[], attendance: Attendance = "in"): SplitParticipant[] {
  return ids.map((id, index) => participant(id, { minutesAfter: index, attendance }));
}

describe("evenShares", () => {
  it("splits evenly when there is no remainder", () => {
    expect(evenShares(100, 4)).toEqual([25, 25, 25, 25]);
  });

  it("gives the remainder to the earliest joiners, one minor unit at a time", () => {
    // 100 / 3 = 33 remainder 1 → the first person absorbs the extra unit.
    expect(evenShares(100, 3)).toEqual([34, 33, 33]);
    // 100 / 6 = 16 remainder 4 → the first four absorb one each.
    expect(evenShares(100, 6)).toEqual([17, 17, 17, 17, 16, 16]);
  });

  it("always sums to exactly the total — never loses or invents a unit", () => {
    for (let total = 0; total <= 400; total += 7) {
      for (let count = 1; count <= 13; count += 1) {
        const shares = evenShares(total, count);
        expect(shares).toHaveLength(count);
        expect(shares.reduce((sum, n) => sum + n, 0)).toBe(total);
      }
    }
  });

  it("never differs by more than one minor unit between any two people", () => {
    for (let total = 1; total <= 200; total += 3) {
      for (let count = 1; count <= 9; count += 1) {
        const shares = evenShares(total, count);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("returns nothing when there is nobody to split across", () => {
    expect(evenShares(100, 0)).toEqual([]);
    expect(evenShares(0, 0)).toEqual([]);
  });

  it("handles a zero total", () => {
    expect(evenShares(0, 3)).toEqual([0, 0, 0]);
  });

  it("still sums exactly for a negative total", () => {
    // Validation rejects negative costs, but the arithmetic must not corrupt
    // anything if one ever reaches it.
    const shares = evenShares(-100, 3);
    expect(shares.reduce((sum, n) => sum + n, 0)).toBe(-100);
  });

  it("handles amounts far larger than any real event", () => {
    const total = 999_999_999;
    const shares = evenShares(total, 7);
    expect(shares.reduce((sum, n) => sum + n, 0)).toBe(total);
  });
});

describe("computeSplit — cost mode none", () => {
  it("gives nobody anything to pay", () => {
    const result = computeSplit({
      costMode: "none",
      costAmountMinor: null,
      participants: roster(["a", "b", "c"]),
    });

    expect(result.totalComputedMinor).toBe(0);
    expect(result.outstandingMinor).toBe(0);
    expect(result.collectedMinor).toBe(0);
    expect(result.shares.every((s) => s.owes === false)).toBe(true);
    expect(result.shares.every((s) => s.computedAmountMinor === 0)).toBe(true);
  });

  it("ignores a stray cost amount", () => {
    const result = computeSplit({
      costMode: "none",
      costAmountMinor: 90_000,
      participants: roster(["a", "b"]),
    });

    expect(result.totalComputedMinor).toBe(0);
  });
});

describe("computeSplit — cost mode per_person", () => {
  it("charges every attending participant the full amount", () => {
    const result = computeSplit({
      costMode: "per_person",
      costAmountMinor: 20_000,
      participants: roster(["a", "b", "c"]),
    });

    expect(result.shares.map((s) => s.computedAmountMinor)).toEqual([20_000, 20_000, 20_000]);
    expect(result.totalComputedMinor).toBe(60_000);
    expect(result.outstandingMinor).toBe(60_000);
  });

  it("charges nothing to out, maybe and waitlisted", () => {
    const result = computeSplit({
      costMode: "per_person",
      costAmountMinor: 20_000,
      participants: [
        participant("a", { minutesAfter: 0, attendance: "in" }),
        participant("b", { minutesAfter: 1, attendance: "out" }),
        participant("c", { minutesAfter: 2, attendance: "maybe" }),
        participant("d", { minutesAfter: 3, attendance: "waitlisted" }),
      ],
    });

    const byId = new Map(result.shares.map((s) => [s.participantId, s]));
    expect(byId.get("a")?.computedAmountMinor).toBe(20_000);
    expect(byId.get("b")?.computedAmountMinor).toBe(0);
    expect(byId.get("c")?.computedAmountMinor).toBe(0);
    expect(byId.get("d")?.computedAmountMinor).toBe(0);
    expect(byId.get("b")?.owes).toBe(false);
    expect(byId.get("d")?.owes).toBe(false);
    expect(result.outstandingMinor).toBe(20_000);
  });
});

describe("computeSplit — cost mode total", () => {
  it("splits evenly and sums to exactly the total", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 120_000,
      participants: roster(["a", "b", "c", "d"]),
    });

    expect(result.shares.map((s) => s.computedAmountMinor)).toEqual([
      30_000, 30_000, 30_000, 30_000,
    ]);
    expect(result.totalComputedMinor).toBe(120_000);
  });

  it("gives the remainder to the earliest joiners", () => {
    // 100_000 across 3 people: 33_334 / 33_333 / 33_333.
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: roster(["a", "b", "c"]),
    });

    const byId = new Map(result.shares.map((s) => [s.participantId, s.computedAmountMinor]));
    expect(byId.get("a")).toBe(33_334);
    expect(byId.get("b")).toBe(33_333);
    expect(byId.get("c")).toBe(33_333);
    expect(result.totalComputedMinor).toBe(100_000);
  });

  it("orders the remainder by join time regardless of input order", () => {
    // 'c' joined first but appears last in the array.
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 100,
      participants: [
        participant("a", { minutesAfter: 10 }),
        participant("b", { minutesAfter: 20 }),
        participant("c", { minutesAfter: 0 }),
      ],
    });

    const byId = new Map(result.shares.map((s) => [s.participantId, s.computedAmountMinor]));
    expect(byId.get("c")).toBe(34);
    expect(byId.get("a")).toBe(33);
    expect(byId.get("b")).toBe(33);
  });

  it("breaks identical join times deterministically by id", () => {
    const same = { minutesAfter: 5 };
    const build = (ids: string[]) =>
      computeSplit({
        costMode: "total",
        costAmountMinor: 100,
        participants: ids.map((id) => participant(id, same)),
      });

    const forwards = build(["a", "b", "c"]);
    const backwards = build(["c", "b", "a"]);

    const amount = (r: ReturnType<typeof build>, id: string) =>
      r.shares.find((s) => s.participantId === id)?.computedAmountMinor;

    // Same roster, different array order, identical result.
    expect(amount(forwards, "a")).toBe(amount(backwards, "a"));
    expect(amount(forwards, "a")).toBe(34);
    expect(amount(forwards, "b")).toBe(33);
  });

  it("splits only across attending participants", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 90_000,
      participants: [
        participant("a", { minutesAfter: 0, attendance: "in" }),
        participant("b", { minutesAfter: 1, attendance: "out" }),
        participant("c", { minutesAfter: 2, attendance: "in" }),
        participant("d", { minutesAfter: 3, attendance: "maybe" }),
        participant("e", { minutesAfter: 4, attendance: "waitlisted" }),
        participant("f", { minutesAfter: 5, attendance: "in" }),
      ],
    });

    const byId = new Map(result.shares.map((s) => [s.participantId, s.computedAmountMinor]));
    expect(byId.get("a")).toBe(30_000);
    expect(byId.get("c")).toBe(30_000);
    expect(byId.get("f")).toBe(30_000);
    expect(byId.get("b")).toBe(0);
    expect(byId.get("d")).toBe(0);
    expect(byId.get("e")).toBe(0);
    expect(result.totalComputedMinor).toBe(90_000);
  });

  it("charges nobody when nobody is attending", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 90_000,
      participants: roster(["a", "b"], "maybe"),
    });

    expect(result.totalComputedMinor).toBe(0);
    expect(result.outstandingMinor).toBe(0);
  });

  it("charges the whole cost to a single attendee", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 77_777,
      participants: roster(["a"]),
    });

    expect(result.shares[0]?.computedAmountMinor).toBe(77_777);
    expect(result.totalComputedMinor).toBe(77_777);
  });

  it("re-splits when the roster grows, and still sums exactly", () => {
    const before = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: roster(["a", "b", "c"]),
    });
    const after = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: roster(["a", "b", "c", "d", "e", "f"]),
    });

    expect(before.totalComputedMinor).toBe(100_000);
    expect(after.totalComputedMinor).toBe(100_000);
    expect(after.shares[0]?.computedAmountMinor).toBe(16_667);
    expect(after.shares.reduce((sum, s) => sum + s.computedAmountMinor, 0)).toBe(100_000);
  });
});

describe("computeSplit — confirmed payments are never recomputed", () => {
  it("keeps the confirmed amount when the split changes", () => {
    // Three people at 33_334 / 33_333 / 33_333; 'a' pays their 33_334.
    // Then three more join, dropping everyone's share to ~16_667.
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: [
        participant("a", {
          minutesAfter: 0,
          payment: { status: "confirmed", amountMinor: 33_334 },
        }),
        participant("b", { minutesAfter: 1 }),
        participant("c", { minutesAfter: 2 }),
        participant("d", { minutesAfter: 3 }),
        participant("e", { minutesAfter: 4 }),
        participant("f", { minutesAfter: 5 }),
      ],
    });

    const a = result.shares.find((s) => s.participantId === "a");
    expect(a?.computedAmountMinor).toBe(16_667);
    // The money already handed over stands.
    expect(a?.effectiveAmountMinor).toBe(33_334);
    expect(a?.discrepancyMinor).toBe(16_667);
  });

  it("surfaces the difference instead of silently reconciling it", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: [
        participant("a", {
          minutesAfter: 0,
          payment: { status: "confirmed", amountMinor: 50_000 },
        }),
        participant("b", { minutesAfter: 1 }),
        participant("c", { minutesAfter: 2 }),
        participant("d", { minutesAfter: 3 }),
      ],
    });

    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0]).toEqual({
      participantId: "a",
      confirmedAmountMinor: 50_000,
      computedAmountMinor: 25_000,
      differenceMinor: 25_000,
    });
  });

  it("reports a negative difference when somebody underpaid", () => {
    // 'a' paid a 25_000 share, then two people dropped out and the share rose.
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: [
        participant("a", {
          minutesAfter: 0,
          payment: { status: "confirmed", amountMinor: 25_000 },
        }),
        participant("b", { minutesAfter: 1 }),
      ],
    });

    expect(result.discrepancies[0]?.differenceMinor).toBe(-25_000);
    expect(result.shares[0]?.effectiveAmountMinor).toBe(25_000);
  });

  it("reports no discrepancy when the confirmed amount still matches", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: [
        participant("a", {
          minutesAfter: 0,
          payment: { status: "confirmed", amountMinor: 50_000 },
        }),
        participant("b", { minutesAfter: 1 }),
      ],
    });

    expect(result.discrepancies).toHaveLength(0);
    expect(result.shares[0]?.discrepancyMinor).toBe(0);
  });

  it("does recompute pending payments", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: [
        participant("a", { minutesAfter: 0, payment: { status: "pending", amountMinor: 99_999 } }),
        participant("b", { minutesAfter: 1 }),
      ],
    });

    expect(result.shares[0]?.effectiveAmountMinor).toBe(50_000);
    expect(result.discrepancies).toHaveLength(0);
  });
});

describe("computeSplit — totals", () => {
  it("spreads a waived share over everyone still paying", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 120_000,
      participants: [
        participant("a", {
          minutesAfter: 0,
          payment: { status: "confirmed", amountMinor: 30_000 },
        }),
        participant("b", {
          minutesAfter: 1,
          payment: { status: "confirmed", amountMinor: 30_000 },
        }),
        participant("c", { minutesAfter: 2, payment: { status: "pending", amountMinor: 30_000 } }),
        participant("d", { minutesAfter: 3, payment: { status: "waived", amountMinor: 30_000 } }),
      ],
    });

    /*
      Four attendees, one waived: the $120.000 divides among the THREE who
      pay, at $40.000 each, instead of four at $30.000 with the organizer
      quietly covering the fourth.
    */
    const byId = new Map(result.shares.map((share) => [share.participantId, share]));
    expect(byId.get("d")?.computedAmountMinor).toBe(0);
    expect(byId.get("c")?.computedAmountMinor).toBe(40_000);
    expect(result.totalComputedMinor).toBe(120_000);

    // The two who paid the old $30.000 now sit $10.000 behind — the exact
    // gap `computeSettlement` turns into a collection round.
    expect(byId.get("a")?.discrepancyMinor).toBe(-10_000);
    expect(byId.get("b")?.discrepancyMinor).toBe(-10_000);

    expect(result.collectedMinor).toBe(60_000);
    expect(result.outstandingMinor).toBe(40_000);
  });

  it("does not count out / maybe / waitlisted towards outstanding", () => {
    const result = computeSplit({
      costMode: "per_person",
      costAmountMinor: 15_000,
      participants: [
        participant("a", { minutesAfter: 0, attendance: "in" }),
        participant("b", { minutesAfter: 1, attendance: "out" }),
        participant("c", { minutesAfter: 2, attendance: "waitlisted" }),
      ],
    });

    expect(result.outstandingMinor).toBe(15_000);
  });

  it("treats a missing payment row as pending", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 50_000,
      participants: roster(["a", "b"]),
    });

    expect(result.shares.every((s) => s.status === "pending")).toBe(true);
    expect(result.outstandingMinor).toBe(50_000);
  });

  it("counts a confirmed payment from someone who has since dropped out", () => {
    // They paid, then said they can't come. The organizer is holding their
    // money and needs to see it rather than have it disappear from the total.
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: [
        participant("a", { minutesAfter: 0 }),
        participant("b", {
          minutesAfter: 1,
          attendance: "out",
          payment: { status: "confirmed", amountMinor: 50_000 },
        }),
      ],
    });

    expect(result.collectedMinor).toBe(50_000);
    expect(result.shares.find((s) => s.participantId === "b")?.owes).toBe(false);
    expect(result.discrepancies).toHaveLength(1);
  });
});

describe("computeSplit — the definition-of-done scenario", () => {
  it("splits a 250_000 event across six people to exactly 250_000", () => {
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 250_000,
      participants: roster(["p1", "p2", "p3", "p4", "p5", "p6"]),
    });

    // 250_000 / 6 = 41_666 remainder 4 → the first four pay one peso more.
    expect(result.shares.map((s) => s.computedAmountMinor)).toEqual([
      41_667, 41_667, 41_667, 41_667, 41_666, 41_666,
    ]);
    expect(result.shares.reduce((sum, s) => sum + s.computedAmountMinor, 0)).toBe(250_000);
    expect(result.outstandingMinor).toBe(250_000);
  });

  it("shows the right outstanding total after three of six pay", () => {
    const shares = [41_667, 41_667, 41_667, 41_667, 41_666, 41_666];
    const result = computeSplit({
      costMode: "total",
      costAmountMinor: 250_000,
      participants: ["p1", "p2", "p3", "p4", "p5", "p6"].map((id, index) =>
        participant(id, {
          minutesAfter: index,
          payment: index < 3 ? { status: "confirmed", amountMinor: shares[index] ?? 0 } : null,
        }),
      ),
    });

    expect(result.collectedMinor).toBe(125_001);
    expect(result.outstandingMinor).toBe(124_999);
    expect(result.collectedMinor + result.outstandingMinor).toBe(250_000);
    expect(result.discrepancies).toHaveLength(0);
  });
});

describe("the convocatoria's quota (total mode with capacity)", () => {
  const people = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      joinedAt: new Date(2026, 0, i + 1),
      attendance: "in" as const,
      payment: null,
    }));

  it("asks each pending seat for total/capacity, not the live split", () => {
    // $260.000 entre 10 cupos = $26.000 la cuota — aunque solo haya UNA
    // persona adentro. El primero en llegar NO carga el evento entero.
    const split = computeSplit({
      costMode: "total",
      costAmountMinor: 260_000_00,
      capacity: 10,
      participants: people(1),
    });

    expect(split.shares[0]!.effectiveAmountMinor).toBe(26_000_00);
    // The FINAL truth stays the live split — settlement depends on it.
    expect(split.shares[0]!.computedAmountMinor).toBe(260_000_00);
    expect(split.outstandingMinor).toBe(26_000_00);
  });

  it("bills a sponsor the quota times their seats", () => {
    const [sponsor] = people(1);
    const split = computeSplit({
      costMode: "total",
      costAmountMinor: 260_000_00,
      capacity: 10,
      participants: [{ ...sponsor!, weight: 3 }],
    });

    expect(split.shares[0]!.effectiveAmountMinor).toBe(78_000_00);
  });

  it("keeps confirmed money and the settlement arithmetic untouched", () => {
    // Paid the quota, then the roster settled at 8 of 10: the discrepancy
    // against the LIVE split is what Cuentas finales reads.
    const eight = people(8).map((p) => ({
      ...p,
      payment: { status: "confirmed" as const, amountMinor: 26_000_00 },
    }));
    const split = computeSplit({
      costMode: "total",
      costAmountMinor: 260_000_00,
      capacity: 10,
      participants: eight,
    });

    expect(split.shares[0]!.computedAmountMinor).toBe(32_500_00);
    expect(split.shares[0]!.discrepancyMinor).toBe(-6_500_00);
  });

  it("changes nothing without a capacity", () => {
    const split = computeSplit({
      costMode: "total",
      costAmountMinor: 100_00,
      participants: people(2),
    });
    expect(split.shares.map((s) => s.effectiveAmountMinor)).toEqual([50_00, 50_00]);
  });
});
