import "server-only";

import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { db } from "@/db/client";
import { events, participants, payments } from "@/db/schema";
import type { EventRow } from "@/db/schema";
import { planLedger } from "@/domain/ledger";

/**
 * Keeps the payment ledger in step with the roster and the cost.
 *
 * Called after anything that can move a share: an RSVP, an added or removed
 * participant, a promotion, an edit to the cost.
 *
 * **What to change, and what it costs, is decided in `planLedger`** — a pure
 * function with its own tests. All that happens here is reading the roster,
 * asking for a plan, and applying it. That division is deliberate: while the
 * decision lived in this file, interleaved with `await`s, testing it needed a
 * database, so it was never tested, and it destroyed confirmed payments for
 * months without anybody noticing.
 *
 * **The whole thing runs in one transaction, behind a lock on the event row.**
 * Every share depends on how many people are attending, so two RSVPs landing
 * together used to read the same stale roster and compute the same wrong
 * denominator — the second write silently overwriting the first, leaving
 * everybody billed for a headcount that never existed. Serialising per event is
 * the cheap fix, and the contention is a handful of writes on one event.
 */
export async function syncPayments(event: EventRow): Promise<void> {
  await db.transaction(async (tx) => {
    // Serialises concurrent syncs of THIS event and nothing else. Taken before
    // the roster is read, so whoever waits here reads the roster the winner
    // left behind rather than the one they both started from.
    await tx.select({ id: events.id }).from(events).where(eq(events.id, event.id)).for("update");

    const rows = await tx
      .select({ participant: participants, payment: payments })
      .from(participants)
      .leftJoin(payments, eq(payments.participantId, participants.id))
      .where(eq(participants.eventId, event.id));

    const plan = planLedger({
      costMode: event.costMode,
      costAmountMinor: event.costAmountMinor,
      participants: rows.map((row) => ({
        id: row.participant.id,
        joinedAt: row.participant.createdAt,
        attendance: row.participant.attendance,
        payment: row.payment
          ? {
              id: row.payment.id,
              status: row.payment.status,
              amountMinor: row.payment.amountMinor,
            }
          : null,
      })),
    });

    if (plan.remove.length > 0) {
      await tx.delete(payments).where(inArray(payments.id, plan.remove));
    }

    if (plan.create.length > 0) {
      await tx
        .insert(payments)
        .values(
          plan.create.map((row) => ({
            id: uuidv7(),
            participantId: row.participantId,
            amountMinor: row.amountMinor,
            status: "pending" as const,
          })),
        )
        /*
          Belt and braces behind the lock. A payment row is unique per
          participant, and a row appearing between the read and the write —
          from a path that somehow skipped the lock — should leave the existing
          one standing rather than raise a unique violation inside a server
          action, where it surfaces to the organizer as an unexplained failure.
          Doing nothing is the safe branch: the existing row may be confirmed,
          and the next sync corrects a merely stale one.
        */
        .onConflictDoNothing({ target: payments.participantId });
    }

    for (const row of plan.update) {
      await tx.update(payments).set({ amountMinor: row.amountMinor }).where(eq(payments.id, row.paymentId));
    }
  });
}
