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
  people: {
    id: string;
    attendance: "in" | "out";
    paid?: number;
    waived?: boolean;
    accepted?: number;
  }[],
  totalMinor: number,
) {
  const split = computeSplit({
    costMode: "total",
    costAmountMinor: totalMinor,
    participants: people.map((p) => ({
      id: p.id,
      joinedAt: joined,
      attendance: p.attendance,
      payment: p.waived
        ? { status: "waived" as const, amountMinor: 0 }
        : p.paid !== undefined
          ? {
              status: "confirmed" as const,
              amountMinor: p.paid,
              discrepancyAcceptedMinor: p.accepted ?? null,
            }
          : null,
    })),
  });
  const byId = new Map(people.map((p) => [p.id, p.attendance]));
  return computeSettlement(split.shares, (id) => byId.get(id) ?? "out");
}

describe("the settlement", () => {
  it("turns a waiver into a collection round instead of an organizer's loss", () => {
    /*
      Ivan's rule, end to end. Four friends at $40.000 each on a $160.000
      cancha; three have already paid. The organizer then waives the fourth —
      and the cost of that seat must land on the three who are going, not on
      the organizer.

      $160.000 over the three who still pay is $53.333/$53.334 each, so every
      early payer is about $13.334 behind. Those gaps ARE the collection
      round: the settlement card lists them and "Pedir el saldo por correo"
      sends them.
    */
    const settlement = roster(
      [
        { id: "a", attendance: "in", paid: 40_000 },
        { id: "b", attendance: "in", paid: 40_000 },
        { id: "c", attendance: "in", paid: 40_000 },
        { id: "d", attendance: "in", waived: true },
      ],
      160_000,
    );

    expect(settlement.topUps).toHaveLength(3);
    // The waived seat's $40.000 is fully recovered from the three payers,
    // to the peso — nothing is left for the organizer to absorb.
    expect(settlement.shortfallMinor).toBe(40_000);
    for (const topUp of settlement.topUps) {
      expect(topUp.paidMinor).toBe(40_000);
      expect(topUp.missingMinor).toBeGreaterThan(0);
    }
    expect(settlement.refundables).toHaveLength(0);
  });

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

describe("money the organizer is holding for somebody", () => {
  it("names the overpayment when the roster grows under an early payer", () => {
    /*
      Ivan's case, arithmetic and all: ten paid $26.000 for a $260.000
      cancha sold as ten cupos, then two more played. Twelve ways the share
      is $21.667, so each of the ten is $4.333 ahead — and the organizer is
      holding $43.330 belonging to ten named people.
    */
    const settlement = roster(
      [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `paid${i}`,
          attendance: "in" as const,
          paid: 26_000,
        })),
        { id: "late1", attendance: "in" as const },
        { id: "late2", attendance: "in" as const },
      ],
      260_000,
    );

    expect(settlement.overpayments).toHaveLength(10);
    // $4.333 or $4.334 depending on where the rounding remainder landed —
    // the split hands the odd pesos out in join order, so the total is not
    // ten times any one person's figure.
    expect(settlement.overpayments[0]?.extraMinor).toBe(4_333);
    expect(settlement.surplusMinor).toBe(43_334);
    // Nobody is short — this is the opposite failure.
    expect(settlement.topUps).toHaveLength(0);
  });

  it("stops asking once the organizer accepts that drift", () => {
    const settlement = roster(
      [
        { id: "a", attendance: "in", paid: 30_000, accepted: 10_000 },
        { id: "b", attendance: "in", paid: 30_000 },
        { id: "c", attendance: "in" },
      ],
      60_000,
    );

    // Both paid 30.000 against a 20.000 share; only the one who accepted
    // theirs drops off the list.
    expect(settlement.overpayments.map((o) => o.participantId)).toEqual(["b"]);
  });

  it("asks again when the drift changes size, because that is a new fact", () => {
    // Accepted 10.000, but the roster moved and the drift is now 15.000.
    const settlement = roster(
      [
        { id: "a", attendance: "in", paid: 30_000, accepted: 10_000 },
        { id: "b", attendance: "in" },
        { id: "c", attendance: "in" },
        { id: "d", attendance: "in" },
      ],
      60_000,
    );

    expect(settlement.overpayments[0]?.participantId).toBe("a");
    expect(settlement.overpayments[0]?.extraMinor).toBe(15_000);
  });
});
