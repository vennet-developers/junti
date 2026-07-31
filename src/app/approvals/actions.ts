"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { eventPolicies, events, policySubmissions } from "@/db/schema";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";

export interface ApprovalState {
  errors: { _form?: string };
  /** How many rows this call actually decided. */
  decided?: number;
  ok?: boolean;
}

/**
 * Approves or rejects several receipts at once.
 *
 * **Ownership is re-checked in the UPDATE, not before it.** The ids arrive from
 * a client, so the statement itself is scoped to submissions whose event
 * belongs to the signed-in organizer — a subquery rather than a lookup, so
 * there is no window between deciding a row is theirs and writing to it.
 *
 * **Idempotent by construction.** The `status = 'submitted'` predicate is part
 * of the same statement, so a row somebody already judged is not touched and a
 * double submit writes nothing the second time. That is also the answer to the
 * stale queue: a view that still lists a resolved item cannot re-decide it, and
 * the count that comes back says how many were genuinely open — which is what
 * the page reports rather than the number of boxes that were ticked.
 *
 * Rejections are not offered here. A rejection carries a reason back to the
 * participant, and a reason typed once for twenty people is not a reason; the
 * queue links into each event for that.
 */
export async function approveSubmissions(submissionIds: string[]): Promise<ApprovalState> {
  const { copy } = await getViewerCopy();

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  const ids = submissionIds.filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return { errors: {}, decided: 0, ok: true };

  const owned = db
    .select({ id: policySubmissions.id })
    .from(policySubmissions)
    .innerJoin(eventPolicies, eq(policySubmissions.policyId, eventPolicies.id))
    .innerJoin(events, eq(eventPolicies.eventId, events.id))
    .where(
      and(
        inArray(policySubmissions.id, ids),
        eq(events.organizerId, organizer.id),
        eq(policySubmissions.status, "submitted"),
      ),
    );

  const decided = await db
    .update(policySubmissions)
    .set({
      status: "approved",
      // Cleared on approval so an earlier rejection's reason cannot resurface
      // next to a receipt that has now been accepted.
      reviewNote: null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(policySubmissions.id, owned))
    .returning({ id: policySubmissions.id });

  // The roster, the pending counts and this queue are all rendered on the
  // server from the same rows.
  revalidatePath("/", "layout");

  return { errors: {}, decided: decided.length, ok: true };
}
