import { createServerFn } from "@tanstack/react-start";

export interface ApprovalState {
  errors: { _form?: string };
  /** How many rows this call actually decided. */
  decided?: number;
  ok?: boolean;
}

/**
 * Approves or rejects several receipts at once.
 *
 * Successor of the `approveSubmissions` server action in
 * `src/app/approvals/actions.ts`, logic untouched.
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
 *
 * The roster, the pending counts and this queue all render from the same rows,
 * which under Next meant `revalidatePath("/", "layout")` on the way out. That
 * is now the CALLER's second half: the queue calls `router.invalidate()` after
 * success, and every loader re-reads. The dynamic imports keep this module
 * loadable by the client component that calls it.
 */
export const approveSubmissionsFn = createServerFn({ method: "POST" })
  .validator((data: { ids: string[] }) => data)
  .handler(async ({ data }): Promise<ApprovalState> => {
    const [
      { and, eq, inArray },
      { db },
      { eventPolicies, events, policySubmissions },
      { getViewerCopy },
      { deleteEvidenceFor },
      { getOrganizer },
    ] = await Promise.all([
      import("drizzle-orm"),
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/locale"),
      import("@/lib/evidence-store"),
      import("@/lib/organizer"),
    ]);

    const { copy } = await getViewerCopy();

    const organizer = await getOrganizer();
    if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

    const ids = data.ids.filter((id) => typeof id === "string" && id.length > 0);
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

    /*
      The receipts go with the approval — see the note on the single review.

      Driven by `returning()` rather than by the ids that came in: the update is
      already scoped to submissions this organizer owns AND still awaiting review,
      so only the rows that were genuinely decided come back. Deleting from the
      request's list instead would let a stale id from a second tab destroy an
      image belonging to a submission that was never approved here.

      One statement for the batch. Approving fifteen receipts should not be
      fifteen round trips on a queue built for exactly that.
    */
    if (decided.length > 0) {
      await deleteEvidenceFor(decided.map((row) => row.id));
    }

    return { errors: {}, decided: decided.length, ok: true };
  });
