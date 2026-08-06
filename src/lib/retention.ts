import "@/server/assert-server";

import { GUEST_NAME_RETENTION_DAYS } from "@/domain/held-spots";
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";

import { db } from "@/db/client";
import {
  analyticsEvents,
  invitations,
  notifications,
  outboxMessages,
  policyEvidence,
  policySubmissions,
  sendCounters,
  events,
  heldSpots,
} from "@/db/schema";

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

/**
 * A year of funnel history, and then it goes.
 *
 * Long enough to compare this September with last one, which is the longest
 * comparison anybody has asked of a product this age. Not kept forever: the
 * 500 MB allowance is shared with receipt images, which are the real pressure,
 * and an analytics table that only grows is the kind of leak nobody notices
 * until the database is full of the least valuable rows in it.
 *
 * Deleting rather than rolling up. A monthly rollup would keep the counts and
 * cost more code than the space it saves at this volume — a couple of MB a
 * month — and rollups are the sort of thing that quietly disagree with the
 * raw data they replaced.
 */
const ANALYTICS_EVENT_DAYS = 365;

/**
 * How long a delivered message stays in the outbox.
 *
 * Thirty days answers "did that invitation go out?" for as long as anybody
 * asks it, and the row holds a recipient's address — so keeping it forever
 * would quietly turn a dispatch log into a second copy of everyone Junti has
 * ever written to.
 *
 * **Only settled rows.** Anything still pending is waiting for something and
 * deleting it would lose the message; anything `failed` is the operator's
 * evidence of what went wrong and is worth more than the space it costs.
 */
const SENT_OUTBOX_DAYS = 30;

/**
 * Nobody answers an invitation to an event that happened months ago.
 *
 * Still a defensible guess rather than advice. It was written when an
 * invitation row held a stranger's email address, and the open question was
 * how long we could justify keeping one; groups removed the address — the row
 * now names an account that joined the organizer's group — so what expires
 * here is a record of "you were asked", not a piece of somebody's contact
 * details. Lower stakes, same unconfirmed number, and the confirmation belongs
 * with the rest of the Ley 1581 retention classes rather than in its own spike.
 */
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

/**
 * How long a notification that has been read stays in the inbox.
 *
 * Ninety days is long enough that scrolling back to "when did Ana say she was
 * coming?" still works for a season of weekly matches, and short enough that an
 * account which has been here two years is not carrying every answer anybody
 * ever gave it.
 *
 * **Read ones only.** Something unread is something nobody has seen yet, and
 * deleting it would mean the app quietly decided on the reader's behalf that it
 * no longer mattered. An unread notification from a year ago is a bad sign
 * about the product, not a row to clean up.
 */
const READ_NOTIFICATION_DAYS = 90;

export interface RetentionReport {
  guestNames: number;
  invitations: number;
  analyticsEvents: number;
  outboxMessages: number;
  rejectedEvidence: number;
  sendCounters: number;
  notifications: number;
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

  const staleOutbox = await db
    .delete(outboxMessages)
    .where(
      and(
        inArray(outboxMessages.status, ["sent", "suppressed"]),
        lt(outboxMessages.createdAt, daysAgo(SENT_OUTBOX_DAYS)),
      ),
    )
    .returning({ id: outboxMessages.id });

  const staleAnalytics = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.at, daysAgo(ANALYTICS_EVENT_DAYS)))
    .returning({ id: analyticsEvents.id });

  /*
    The image only. The submission row stays, so the roster still shows that
    somebody sent something and it was refused — deleting the decision along
    with the picture would silently reinstate them as owing nothing.
  */
  /*
    A typed subquery, not a `sql` template.

    The first version interpolated a `Date` into raw SQL and Postgres refused
    it: a bare parameter in that position has no column to infer its type from,
    so the driver sends something the planner cannot place. Going through the
    query builder means the comparison is bound against `reviewed_at` and the
    date is typed by the column — the same shape the approvals queue already
    uses to scope its update.
  */
  const rejectedSubmissions = db
    .select({ id: policySubmissions.id })
    .from(policySubmissions)
    .where(
      and(
        eq(policySubmissions.status, "rejected"),
        lt(policySubmissions.reviewedAt, daysAgo(REJECTED_EVIDENCE_DAYS)),
      ),
    );

  const rejected = await db
    .delete(policyEvidence)
    .where(inArray(policyEvidence.submissionId, rejectedSubmissions))
    .returning({ submissionId: policyEvidence.submissionId });

  const counters = await db
    .delete(sendCounters)
    .where(lt(sendCounters.windowStart, daysAgo(SEND_COUNTER_DAYS)))
    .returning({ key: sendCounters.key });

  // Read and old. Never anything still waiting to be seen — see the note on
  // the constant.
  const oldNotifications = await db
    .delete(notifications)
    .where(
      and(
        isNotNull(notifications.readAt),
        lt(notifications.readAt, daysAgo(READ_NOTIFICATION_DAYS)),
      ),
    )
    .returning({ id: notifications.id });

  /*
    Unclaimed guest names on events past their grace window. The NAME goes,
    the ROW stays: deleting the spot would retroactively rewrite what the
    sponsor owed, and the seat they answered for is part of the money history.
    A nulled name renders as "Invitado de {sponsor}", which is all it needs to
    say after the match. See GUEST_NAME_RETENTION_DAYS for the window.
  */
  const purgedGuestNames = await db
    .update(heldSpots)
    .set({ guestName: null })
    .where(
      and(
        isNull(heldSpots.claimedBy),
        isNotNull(heldSpots.guestName),
        inArray(
          heldSpots.eventId,
          db
            .select({ id: events.id })
            .from(events)
            .where(lt(events.startsAt, daysAgo(GUEST_NAME_RETENTION_DAYS))),
        ),
      ),
    )
    .returning({ id: heldSpots.id });

  return {
    guestNames: purgedGuestNames.length,
    invitations: staleInvitations.length,
    analyticsEvents: staleAnalytics.length,
    outboxMessages: staleOutbox.length,
    rejectedEvidence: rejected.length,
    sendCounters: counters.length,
    notifications: oldNotifications.length,
  };
}
