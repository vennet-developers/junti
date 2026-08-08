import { describe, expect, it } from "vitest";

import { planLedger, type LedgerParticipant } from "./ledger";

/**
 * The ledger reconciliation, tested where it could not be tested before.
 *
 * This logic used to live inside `syncPayments`, between database calls, which
 * meant testing it needed a database and so it was never tested at all. The
 * arithmetic beside it — `computeSplit` — was pure and had thirty-odd cases.
 * The untested half is where the data-destroying bug was.
 */

const JOINED = new Date("2026-08-01T12:00:00Z");

function participant(
  id: string,
  attendance: LedgerParticipant["attendance"],
  payment: LedgerParticipant["payment"] = null,
  minutesLate = 0,
): LedgerParticipant {
  return {
    id,
    joinedAt: new Date(JOINED.getTime() + minutesLate * 60_000),
    attendance,
    payment,
  };
}

describe("cost mode none", () => {
  /**
   * The regression this module exists for.
   *
   * Reproduce by hand: create an event with a cost, collect from somebody, mark
   * them confirmed, then edit the event and set it to "sin costo". Before the
   * fix, `syncPayments` deleted every payment row whose `payment` was non-null
   * — a filter that never looked at the status — and the record of who had paid
   * and how much was gone permanently. No warning, no undo, nothing left to
   * reconcile against when the organizer wondered later who still owed them.
   */
  it("never deletes a confirmed payment", () => {
    const plan = planLedger({
      costMode: "none",
      costAmountMinor: null,
      participants: [
        participant("paid", "in", { id: "pay-paid", status: "confirmed", amountMinor: 25_000 }),
        participant("owing", "in", { id: "pay-owing", status: "pending", amountMinor: 25_000 }),
      ],
    });

    expect(plan.remove).toEqual(["pay-owing"]);
    expect(plan.remove).not.toContain("pay-paid");
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
  });

  it("removes pending and waived rows, which are only projections", () => {
    const plan = planLedger({
      costMode: "none",
      costAmountMinor: null,
      participants: [
        participant("a", "in", { id: "pay-a", status: "pending", amountMinor: 10_000 }),
        participant("b", "in", { id: "pay-b", status: "waived", amountMinor: 10_000 }),
      ],
    });

    expect(plan.remove.sort()).toEqual(["pay-a", "pay-b"]);
  });

  it("creates nothing, so a free event never grows a ledger", () => {
    const plan = planLedger({
      costMode: "none",
      costAmountMinor: null,
      participants: [participant("a", "in"), participant("b", "in")],
    });

    expect(plan).toEqual({ create: [], update: [], remove: [] });
  });
});

describe("creating rows", () => {
  it("creates one row per participant, at the computed share", () => {
    const plan = planLedger({
      costMode: "total",
      costAmountMinor: 60_000,
      participants: [participant("a", "in"), participant("b", "in", null, 1)],
    });

    expect(plan.create).toEqual([
      { participantId: "a", amountMinor: 30_000 },
      { participantId: "b", amountMinor: 30_000 },
    ]);
  });

  it("creates a zero row for somebody who is not attending", () => {
    // The row exists so the organizer can mark them paid if they change their
    // mind, and `owes` in the split is what drives the money UI.
    const plan = planLedger({
      costMode: "total",
      costAmountMinor: 60_000,
      participants: [participant("in", "in"), participant("out", "out", null, 1)],
    });

    expect(plan.create).toContainEqual({ participantId: "out", amountMinor: 0 });
  });

  it("hands the indivisible remainder to the earliest joiner", () => {
    const plan = planLedger({
      costMode: "total",
      costAmountMinor: 100,
      participants: [
        participant("first", "in"),
        participant("second", "in", null, 1),
        participant("third", "in", null, 2),
      ],
    });

    expect(plan.create.map((row) => row.amountMinor)).toEqual([34, 33, 33]);
    expect(plan.create.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(100);
  });
});

describe("updating rows", () => {
  it("re-splits a pending row when the roster grows", () => {
    const plan = planLedger({
      costMode: "total",
      costAmountMinor: 60_000,
      participants: [
        participant("a", "in", { id: "pay-a", status: "pending", amountMinor: 60_000 }),
        participant("b", "in", null, 1),
      ],
    });

    expect(plan.update).toEqual([{ paymentId: "pay-a", amountMinor: 30_000 }]);
    expect(plan.create).toEqual([{ participantId: "b", amountMinor: 30_000 }]);
  });

  it("leaves a row alone when its amount already matches", () => {
    const plan = planLedger({
      costMode: "per_person",
      costAmountMinor: 25_000,
      participants: [
        participant("a", "in", { id: "pay-a", status: "pending", amountMinor: 25_000 }),
      ],
    });

    expect(plan.update).toEqual([]);
  });

  it("never rewrites a confirmed amount when the split moves under it", () => {
    // Somebody paid 60.000 as the only attendee. A second person joins, so the
    // share is now 30.000 — but the first already handed over 60.000. The
    // ledger keeps what happened; the organizer settles the difference in
    // person, guided by `computeSplit`'s discrepancy report.
    const plan = planLedger({
      costMode: "total",
      costAmountMinor: 60_000,
      participants: [
        participant("paid", "in", { id: "pay-paid", status: "confirmed", amountMinor: 60_000 }),
        participant("new", "in", null, 1),
      ],
    });

    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.create).toEqual([{ participantId: "new", amountMinor: 30_000 }]);
  });

  it("zeroes a waived row, because its cost moved to the people still paying", () => {
    const plan = planLedger({
      costMode: "total",
      costAmountMinor: 60_000,
      participants: [
        participant("waived", "in", { id: "pay-w", status: "waived", amountMinor: 60_000 }),
        participant("other", "in", null, 1),
      ],
    });

    // The waived row owes nothing, and "other" is now the whole denominator:
    // the $60.000 lands on them rather than half on the organizer.
    expect(plan.update).toEqual([{ paymentId: "pay-w", amountMinor: 0 }]);
    expect(plan.create).toEqual([{ participantId: "other", amountMinor: 60_000 }]);
  });
});

describe("the plan as a whole", () => {
  it("keeps the three lists disjoint", () => {
    const plan = planLedger({
      costMode: "total",
      costAmountMinor: 90_000,
      participants: [
        participant("stale", "in", { id: "pay-stale", status: "pending", amountMinor: 1 }),
        participant("paid", "in", { id: "pay-paid", status: "confirmed", amountMinor: 30_000 }, 1),
        participant("fresh", "in", null, 2),
      ],
    });

    const touched = [
      ...plan.create.map((row) => row.participantId),
      ...plan.update.map((row) => row.paymentId),
      ...plan.remove,
    ];

    expect(new Set(touched).size).toBe(touched.length);
    expect(plan.remove).toEqual([]);
  });

  it("is idempotent: applying it twice changes nothing the second time", () => {
    const participants = [
      participant("a", "in", { id: "pay-a", status: "pending", amountMinor: 30_000 }),
      participant("b", "in", { id: "pay-b", status: "pending", amountMinor: 30_000 }, 1),
    ];

    const plan = planLedger({ costMode: "total", costAmountMinor: 60_000, participants });

    expect(plan).toEqual({ create: [], update: [], remove: [] });
  });
});
