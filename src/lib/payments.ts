import "server-only";

import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { db } from "@/db/client";
import { participants, payments } from "@/db/schema";
import type { EventRow } from "@/db/schema";
import { computeSplit } from "@/domain/split";

/**
 * Keeps the payment ledger in step with the roster and the cost.
 *
 * Called after anything that can move a share: an RSVP, an added or removed
 * participant, a promotion, an edit to the cost. Rows are created lazily — an
 * event with no cost has no payment rows at all.
 *
 * The rule that matters: **a confirmed payment is never rewritten.** That money
 * already changed hands. If the split has moved since, the stored amount stands
 * and the difference surfaces to the organizer as a warning (see
 * `computeSplit`'s `discrepancies`). Silently reconciling it would quietly
 * rewrite what somebody actually paid.
 */
export async function syncPayments(event: EventRow): Promise<void> {
  const rows = await db
    .select({ participant: participants, payment: payments })
    .from(participants)
    .leftJoin(payments, eq(payments.participantId, participants.id))
    .where(eq(participants.eventId, event.id));

  // No cost means no money UI anywhere, so the rows should not exist.
  if (event.costMode === "none") {
    const stale = rows.filter((row) => row.payment !== null).map((row) => row.participant.id);
    if (stale.length > 0) {
      await db.delete(payments).where(inArray(payments.participantId, stale));
    }
    return;
  }

  const split = computeSplit({
    costMode: event.costMode,
    costAmountMinor: event.costAmountMinor,
    participants: rows.map((row) => ({
      id: row.participant.id,
      joinedAt: row.participant.createdAt,
      attendance: row.participant.attendance,
      payment: row.payment
        ? { status: row.payment.status, amountMinor: row.payment.amountMinor }
        : null,
    })),
  });

  const sharesById = new Map(split.shares.map((share) => [share.participantId, share]));

  for (const row of rows) {
    const share = sharesById.get(row.participant.id);
    if (!share) continue;

    if (!row.payment) {
      await db.insert(payments).values({
        id: uuidv7(),
        participantId: row.participant.id,
        amountMinor: share.computedAmountMinor,
        status: "pending",
      });
      continue;
    }

    // Confirmed money is immutable. Leave it exactly as recorded.
    if (row.payment.status === "confirmed") continue;

    if (row.payment.amountMinor !== share.computedAmountMinor) {
      await db
        .update(payments)
        .set({ amountMinor: share.computedAmountMinor })
        .where(eq(payments.id, row.payment.id));
    }
  }
}
