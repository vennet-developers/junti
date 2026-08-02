import "server-only";

import { and, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { invitations, policyEvidence, policySubmissions, sendCounters } from "@/db/schema";

/**
 * Data that expires, and when.
 *
 * The privacy notice promises retention periods. A promise nothing enforces is
 * the kind of claim that is worse than saying nothing, so this is the thing
 * that makes it true — run on a schedule, not on a hope that somebody
 * remembers.
 *
 * **Deliberately narrow.** It deletes what has no remaining purpose and nothing
 * that anybody's numbers depend on. Events, participants and payments are never
 * touched: a five-a-side from two years ago is still the record of who paid
 * whom, and quietly erasing it would break the one thing this product is for.
 */

/** Nobody answers an invitation to an event that happened months ago. */
const UNANSWERED_INVITATION_DAYS = 180;

/**
 * A rejected receipt has been superseded or abandoned.
 *
 * Longer than feels necessary on purpose: a rejection is the start of an
 * argument, and destroying the image while the two of them are still working it
 * out is exactly the wrong moment. Approved ones are already deleted the moment
 * they are approved.
 */
const REJECTED_EVIDENCE_DAYS = 90;

/** Windows older than this are arithmetic nobody will ever read again. */
const SEND_COUNTER_DAYS = 2;

export interface RetentionReport {
  invitations: number;
  rejectedEvidence: number;
  sendCounters: number;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Runs every rule and reports what went.
 *
 * Counts rather than silence: a retention job that says nothing is
 * indistinguishable from one that is not running, and the second is the state
 * this codebase was in for as long as `deleteEvidence` went uncalled.
 */
export async function runRetention(): Promise<RetentionReport> {
  // Never answered, and old enough that answering is not the point any more.
  // An accepted invitation keeps its row — it is how the organizer sees that
  // the person on the roster was invited rather than arriving from a link.
  const staleInvitations = await db
    .delete(invitations)
    .where(
      and(
        isNull(invitations.participantId),
        lt(invitations.sentAt, daysAgo(UNANSWERED_INVITATION_DAYS)),
      ),
    )
    .returning({ id: invitations.id });

  /*
    The image only. The submission row stays, so the roster still shows that
    somebody sent something and it was refused — deleting the decision along
    with the picture would silently reinstate them as owing nothing.
  */
  const rejected = await db
    .delete(policyEvidence)
    .where(
      sql`${policyEvidence.submissionId} in (
        select ${policySubmissions.id} from ${policySubmissions}
        where ${policySubmissions.status} = 'rejected'
          and ${policySubmissions.reviewedAt} < ${daysAgo(REJECTED_EVIDENCE_DAYS)}
      )`,
    )
    .returning({ submissionId: policyEvidence.submissionId });

  const counters = await db
    .delete(sendCounters)
    .where(lt(sendCounters.windowStart, daysAgo(SEND_COUNTER_DAYS)))
    .returning({ key: sendCounters.key });

  return {
    invitations: staleInvitations.length,
    rejectedEvidence: rejected.length,
    sendCounters: counters.length,
  };
}
