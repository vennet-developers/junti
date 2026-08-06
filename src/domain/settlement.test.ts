import { describe, expect, it } from "vitest";

import { computeSettlement } from "./settlement";
import { computeSplit } from "./split";

/**
 * The cancha scenario, end to end through the real split: ten expected, two
 * drop out, and the module has to turn the frozen payments into the exact
 * sentences the organizer needs.
 */

const joined = new Date("2026-08-01T00:00:00Z");

function roster(
  people: { id: string; attendance: "in" | "out"; paid?: number }[],
  totalMinor: number,
) {
  const split = computeSplit({
    costMode: "total",
    costAmountMinor: totalMinor,
    participants: people.map((p) => ({
      id: p.id,
      joinedAt: joined,
      attendance: p.attendance,
      payment: p.paid !== undefined ? { status: "confirmed" as const, amountMinor: p.paid } : null,
    })),
  });
  const byId = new Map(people.map((p) => [p.id, p.attendance]));
  return computeSettlement(split.shares, (id) => byId.get(id) ?? "out");
}

describe("the settlement", () => {
  it("asks early payers for exactly the difference the dropouts left", () => {
    // Ten-way split of 160.000 = 16.000 each; two leave; eight-way = 20.000.
    const people = [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `p${i}`,
        attendance: "in" as const,
        paid: 16_000,
      })),
      { id: "out1", attendance: "out" as const },
      { id: "out2", attendance: "out" as const },
    ];
    const settlement = roster(people, 160_000);

    expect(settlement.topUps).toHaveLength(8);
    for (const topUp of settlement.topUps) {
      expect(topUp.finalShareMinor).toBe(20_000);
      expect(topUp.missingMinor).toBe(4_000);
    }
    // 8 × 4.000 recovers exactly the two lost shares.
    expect(settlement.shortfallMinor).toBe(32_000);
  });

  it("reports dropouts' confirmed money as refundable, never redistributes it", () => {
    const settlement = roster(
      [
        { id: "ana", attendance: "in", paid: 16_000 },
        { id: "leo", attendance: "out", paid: 16_000 },
      ],
      32_000,
    );

    expect(settlement.refundables).toEqual([{ participantId: "leo", paidMinor: 16_000 }]);
    // Ana's final share is the whole 32.000; her top-up ignores Leo's money.
    expect(settlement.topUps[0]).toMatchObject({ paidMinor: 16_000, missingMinor: 16_000 });
  });

  it("leaves pending payers alone — planLedger already moved their number", () => {
    const settlement = roster(
      [
        { id: "ana", attendance: "in", paid: 16_000 },
        { id: "beto", attendance: "in" }, // pendiente: su cuota ya subió sola
        { id: "out1", attendance: "out" },
      ],
      48_000,
    );

    expect(settlement.topUps.map((t) => t.participantId)).toEqual(["ana"]);
  });

  it("does not chase over-payers or invent refunds for them", () => {
    // Ana paid 20.000 when the split was tighter; now her share is 16.000.
    const settlement = roster(
      [
        { id: "ana", attendance: "in", paid: 20_000 },
        { id: "beto", attendance: "in", paid: 16_000 },
        { id: "caro", attendance: "in" },
      ],
      48_000,
    );

    expect(settlement.topUps).toHaveLength(0);
    expect(settlement.refundables).toHaveLength(0);
    expect(settlement.shortfallMinor).toBe(0);
  });

  it("is empty when everyone paid their final share", () => {
    const settlement = roster(
      [
        { id: "a", attendance: "in", paid: 20_000 },
        { id: "b", attendance: "in", paid: 20_000 },
      ],
      40_000,
    );
    expect(settlement.topUps).toHaveLength(0);
    expect(settlement.shortfallMinor).toBe(0);
  });
});
