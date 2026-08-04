import { computeSplit } from "./split";
import type { Attendance, CostMode, PaymentStatus } from "./types";

/**
 * What the payment ledger should look like, decided without touching a database.
 *
 * `computeSplit` answers "what does each person owe". This answers the next
 * question: "given what is already stored, which rows must be created, changed
 * or removed to get there". The two were one function for a while, and the
 * arithmetic half was pure and thoroughly tested while this half lived inside
 * `syncPayments`, interleaved with `await`s — untestable without a database,
 * and therefore untested. That is exactly where the worst bug in the money path
 * was hiding: cost mode `none` deleted every payment row, confirmed ones
 * included, destroying the record of who had actually paid.
 *
 * So the rule that governs this file: **a confirmed payment is a fact about the
 * past.** It records money that changed hands. Nothing here may rewrite one or
 * delete one — not a re-split, not a roster change, not the organizer deciding
 * the event is free after all. Everything else is a projection of the current
 * cost and roster, and may be recomputed freely.
 */

export interface LedgerParticipant {
  id: string;
  /** `created_at`. Decides who absorbs the rounding remainder. */
  joinedAt: Date;
  attendance: Attendance;
  /** Null when no payment row exists yet. */
  payment: { id: string; status: PaymentStatus; amountMinor: number } | null;
}

export interface LedgerInput {
  costMode: CostMode;
  costAmountMinor: number | null;
  participants: readonly LedgerParticipant[];
}

export interface LedgerPlan {
  /** Participants with no payment row yet, and what they owe. */
  create: { participantId: string; amountMinor: number }[];
  /** Existing rows whose amount has drifted from the current split. */
  update: { paymentId: string; amountMinor: number }[];
  /** Rows that should no longer exist. Never a confirmed one. */
  remove: string[];
}

/**
 * Reconciles the stored ledger against the current cost and roster.
 *
 * Returns the three lists a caller must apply, in the order create / update /
 * remove — they are disjoint, so the order only matters for readability.
 */
export function planLedger(input: LedgerInput): LedgerPlan {
  const { costMode, costAmountMinor, participants } = input;

  const plan: LedgerPlan = { create: [], update: [], remove: [] };

  /*
    No cost means no money UI anywhere, so the projected rows should not exist.

    Confirmed rows are not projections and stay. This is the fix for the bug
    that motivated this module: an organizer who collected from half the roster
    and then edited the event to "sin costo" — a plausible thing to do when a
    match ends up free — silently destroyed every record of who had paid, with
    no warning and no way back. The money left in their hands was real; the row
    is the only place the app remembers it.

    A `waived` row goes, unlike a confirmed one. Waiving forgives a debt, and
    once there is no debt there is nothing left to forgive — it describes the
    cost that was, not money that moved.
  */
  if (costMode === "none") {
    for (const participant of participants) {
      if (participant.payment && participant.payment.status !== "confirmed") {
        plan.remove.push(participant.payment.id);
      }
    }
    return plan;
  }

  const split = computeSplit({ costMode, costAmountMinor, participants });
  const sharesById = new Map(split.shares.map((share) => [share.participantId, share]));

  for (const participant of participants) {
    const share = sharesById.get(participant.id);
    if (!share) continue;

    if (!participant.payment) {
      plan.create.push({ participantId: participant.id, amountMinor: share.computedAmountMinor });
      continue;
    }

    // Confirmed money is immutable. The drift, if any, is reported to the
    // organizer by `computeSplit` as a discrepancy rather than reconciled here.
    if (participant.payment.status === "confirmed") continue;

    if (participant.payment.amountMinor !== share.computedAmountMinor) {
      plan.update.push({
        paymentId: participant.payment.id,
        amountMinor: share.computedAmountMinor,
      });
    }
  }

  return plan;
}
