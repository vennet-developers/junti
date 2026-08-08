import "@/server/assert-server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { getCopy } from "@/config/copy";
import type { Copy } from "@/config/copy";
import { db } from "@/db/client";
import {
  eventPolicies,
  events,
  invitations,
  participants,
  payments,
  policyDefinitions,
  policySubmissions,
} from "@/db/schema";
import type { EventRow } from "@/db/schema";
import { suppressedAmong } from "@/lib/consent";
import { claimSends } from "@/lib/send-limit";
import { getSetting } from "@/lib/settings";
import { deleteEvidence } from "@/lib/evidence-store";
import { notify } from "@/lib/notify";
import type { OutboundAttachment, OutboundMessage } from "@/lib/email/port";
import { calendarAttachment } from "@/lib/calendar";
import { enqueueAndSend } from "@/lib/outbox";
import { formatEventDateTime } from "@/lib/format";
import { resolveEventLocale } from "@/lib/locale";
import { syncPayments } from "@/lib/payments";
import { getOrganizer } from "@/lib/organizer";
import { authorizeOrganizer, findSubmissionInEvent, loadInvitations } from "@/lib/roster";
import { track } from "@/lib/analytics";
import { invitableMembers } from "@/domain/groups";
import { changedFields, type ChangedField } from "@/domain/notifications";
import { ROUTES } from "@/config/routes";
import { participantPath } from "@/lib/urls";
import {
  field,
  fieldErrors,
  makeEventSchema,
  makeInviteSchema,
  parsePoliciesField,
  participantIdSchema,
  paymentStatusSchema,
  reviewSubmissionSchema,
} from "@/lib/validation";

/**
 * Organizer mutations.
 *
 * Every one of these re-validates BOTH tokens against the database before
 * touching anything. The client is never trusted to say what role it has — a
 * participant who guesses the shape of an action payload still cannot reach any
 * of this without the organizer token, and the token is checked server-side on
 * every single call rather than once at page load.
 */

/**
 * A `"use server"` module may only export async functions, so initial states for
 * `useActionState` are declared in the client components rather than here.
 */
export type ManageState = { errors: Record<string, string>; ok?: boolean };

/**
 * What a send came to, counted rather than narrated.
 *
 * Three numbers because one paste can end three ways at once: some went, some
 * were skipped as already answered, some failed at the provider. A single "done"
 * would hide the third, and the third is the one worth telling somebody about.
 */
// The limits moved to `app_settings` so they can be turned down without a
// deploy — see `src/lib/settings.ts`. The defaults still live in code.

export type InviteState = ManageState & {
  sent?: number;
  skipped?: number;
  failed?: number;
};

/**
 * Loads the event only if the token pair is valid, and refreshes both views on
 * success. Returns null when the caller is not the organizer.
 */
async function authorize(publicToken: string, organizerToken: string): Promise<EventRow | null> {
  // A session first, always: the token delegates which event, the session says
  // who. Neither is taken from anything the client asserts.
  const organizer = await getOrganizer();
  if (!organizer) return null;

  return authorizeOrganizer(publicToken, organizerToken, organizer.id);
}

/*
  The `refresh` helper that revalidated both views is gone: under TanStack the
  CLIENT re-runs the loaders (`router.invalidate()`) after each successful
  mutation, which refreshes whichever of the two pages is open. The other page
  reloads its own loader on next visit, exactly as it did under Next.
*/

/**
 * The strings for the language this event is being managed in.
 *
 * Resolved per call because a server action has no React context to read it
 * from. Every early return below needs it, which is why `forbidden` became a
 * function — it used to be a constant, and a constant would have frozen one
 * language into the module.
 */
async function eventCopy(eventLocale: string): Promise<Copy> {
  return getCopy(await resolveEventLocale(eventLocale));
}

/** Denial before the event is known, so there is no event language to use. */
async function denied(): Promise<ManageState> {
  const copy = getCopy(await resolveEventLocale("es"));
  return { errors: { _form: copy.errors.forbidden } };
}

/**
 * Toggles a participant's payment between pending, confirmed and waived.
 *
 * Takes plain arguments rather than FormData: it is invoked straight from a
 * button, so there is no form to serialise and therefore no hidden inputs to
 * carry the ids. The arguments are still validated here — a bound argument is
 * client-supplied data like any other.
 */
export async function setPaymentStatus(
  publicToken: string,
  organizerToken: string,
  rawParticipantId: string,
  rawStatus: string,
  rawMethod?: string,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const participantId = participantIdSchema.safeParse(rawParticipantId);
  const status = paymentStatusSchema.safeParse(rawStatus);

  if (!participantId.success || !status.success) {
    return { errors: { _form: copy.errors.notFound } };
  }

  const method = rawMethod?.trim() || null;

  // Scoped by event id so an organizer of one event cannot touch another's rows
  // by passing a foreign participant id.
  const [participant] = await db
    .select({ id: participants.id, userId: participants.userId })
    .from(participants)
    .where(and(eq(participants.id, participantId.data), eq(participants.eventId, event.id)))
    .limit(1);

  if (!participant) return { errors: { _form: copy.errors.notFound } };

  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.participantId, participant.id))
    .limit(1);

  if (!existing) {
    // No row yet — the event probably had no cost when this participant joined.
    // syncPayments creates it, then we set the requested status.
    await syncPayments(event);
  }

  await db
    .update(payments)
    .set({
      status: status.data,
      method,
      confirmedAt: status.data === "confirmed" ? new Date() : null,
    })
    .where(eq(payments.participantId, participant.id));

  /*
    Standing credit is spent at exactly this instant, and given back at its
    opposite. The ask stored on the row is the FULL share; what the credit
    covers is worked out here, so somebody who was asked for $21.667 because
    they were owed $4.333 ends up recorded as having settled all $26.000 —
    part transferred, part credited. See `src/lib/credits.ts`.
  */
  if (status.data === "confirmed") {
    const { spendCreditsOnConfirm } = await import("@/lib/credits");
    const [row] = await db
      .select({ amountMinor: payments.amountMinor, creditApplied: payments.creditAppliedMinor })
      .from(payments)
      .where(eq(payments.participantId, participant.id))
      .limit(1);

    // Only on the way IN. Re-confirming a payment that already spent credit
    // must not spend it twice.
    if (row && row.creditApplied === 0) {
      await spendCreditsOnConfirm({
        participantId: participant.id,
        userId: participant.userId,
        organizerId: event.organizerId,
        currency: event.currency,
        askMinor: row.amountMinor,
      });
    }
  } else {
    const { releaseCredits } = await import("@/lib/credits");
    await releaseCredits(participant.id);
  }

  /*
    Undoing a confirmation puts the row back under the split's control.

    While it was confirmed, the stored amount was frozen at whatever was
    actually handed over, and `syncPayments` skipped it on every pass. Reverting
    the status without this leaves that frozen figure on a now-pending row: the
    reader recomputes and hides it, but the ledger itself keeps a number the
    roster no longer supports, waiting for the first thing that trusts it.
  */
  if (status.data !== "confirmed") await syncPayments(event);

  /*
    reviewSubmission's rule, read in the other direction: recording the money
    settles the receipt. "Marcar como pagado" while a comprobante waits in
    the queue must not leave that comprobante asking for a second judgment
    about the same transfer — the organizer just made it. So a confirmation
    approves any pending proof_of_payment submission exactly as the review
    button would: status, timestamps, and the evidence deleted, because a
    receipt whose question is answered is only a liability (see
    reviewSubmission). No separate notification — the payment_recorded one
    below already tells them, and "aprobado" twice for one tap is noise.
  */
  if (status.data === "confirmed") {
    const pendingProofs = await db
      .select({ id: policySubmissions.id })
      .from(policySubmissions)
      .innerJoin(eventPolicies, eq(eventPolicies.id, policySubmissions.policyId))
      .innerJoin(policyDefinitions, eq(policyDefinitions.id, eventPolicies.policyDefinitionId))
      .where(
        and(
          eq(eventPolicies.eventId, event.id),
          eq(policySubmissions.participantId, participant.id),
          eq(policyDefinitions.slug, "proof_of_payment"),
          eq(policySubmissions.status, "submitted"),
        ),
      );

    for (const proof of pendingProofs) {
      await db
        .update(policySubmissions)
        .set({ status: "approved", reviewNote: null, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(policySubmissions.id, proof.id));
      await deleteEvidence(proof.id);
      track("policy_reviewed", { event_id: event.id, decision: "approved" });
    }
  }

  /*
    Told, and only about the two settled outcomes.

    Moving somebody back to `pending` is an organizer correcting their own
    bookkeeping, and "your payment is no longer on the record" is an accusation
    delivered by a robot. If the money really did not arrive, that is a
    conversation between two people, not a notification.

    Nothing here carries the amount, for the same reason the analytics event
    does not: the ledger is exact and is where money lives.
  */
  const settled = status.data === "confirmed" || status.data === "waived";

  if (participant.userId && settled && existing?.status !== status.data) {
    const { record } = await import("@/lib/notifications");
    const actor = await getOrganizer();

    await record(
      [
        {
          userId: participant.userId,
          type: "payment_recorded",
          eventId: event.id,
          payload: { status: status.data },
        },
      ],
      actor?.id ?? null,
    );
  }

  // The status, never the amount. The ledger is exact and is the only place
  // money belongs; a weaker second copy here would be a liability.
  track("payment_recorded", { event_id: event.id, status: status.data, method: method ?? null });

  return { errors: {}, ok: true };
}

/**
 * The message describing one invitation, ready for the port.
 *
 * The date is formatted HERE rather than in the template, because the template
 * receives strings only — a contract that survives crossing a process boundary
 * if sending ever moves to a queue, and one a WhatsApp adapter can reuse without
 * learning about `Date` or time zones.
 */
function invitationMessage(
  event: EventRow,
  organizerName: string,
  /** Resolved from the account at send time — never typed by an organizer. */
  email: string,
  unsubscribeToken: string,
  copy: Copy,
  calendar?: OutboundAttachment,
): OutboundMessage {
  return {
    to: email,
    attachments: calendar ? [calendar] : undefined,
    template: "event-invitation",
    locale: event.locale,
    values: {
      organizerName,
      eventTitle: event.title,
      eventWhen: formatEventDateTime(event.startsAt, event.timeZone, copy.intlLocale),
      // The template checks for empty rather than taking a null: see the
      // `values` contract on OutboundMessage — strings, all the way down.
      eventWhere: event.location ?? "",
      eventPath: participantPath(event.publicToken),
      unsubscribePath: `${ROUTES.unsubscribe}?t=${unsubscribeToken}`,
    },
  };
}

/**
 * Invites people from the event's group.
 *
 * **This replaced a textarea of pasted addresses**, and before that, adding a
 * participant by hand. Each step gave up a power the organizer should never
 * have had. Adding by hand wrote somebody's name onto a roster they had never
 * seen. Pasting addresses wrote to people who had never agreed to hear from
 * this app at all. What is left claims only what is true: somebody joined this
 * organizer's group, and is now being asked to one of their events.
 *
 * The consent check is the whole point, so it is done here against the
 * database rather than trusted from the form: the selection arrives as user
 * ids, and every one must correspond to a `joined` membership of the group
 * THIS event is attached to. A tampered payload naming a stranger's id finds no
 * membership and sends nothing.
 *
 * Rows are written BEFORE anything is sent, and a send that fails does not roll
 * one back. An invitation that exists but did not arrive is recoverable — the
 * organizer can see it sitting there and resend. A message that went out with no
 * row behind it is not: it would be invisible here and the same person would be
 * invited again on the next click.
 */
export async function inviteToEvent(
  publicToken: string,
  organizerToken: string,
  formData: FormData,
): Promise<InviteState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const maxPerSend = await getSetting("maxInvitesPerSend");
  const parsed = makeInviteSchema(copy, maxPerSend).safeParse(formData.getAll("members").map(String));
  if (!parsed.success) return { errors: fieldErrors(parsed.error, "members") };

  const picked = parsed.data;

  // Whoever is asking, by name. Falls back to the event's title-holder wording
  // when managing purely by token, which is possible for a co-organizer who was
  // handed the manage link.
  const organizer = await getOrganizer();
  const organizerName = organizer?.displayName ?? copy.invites.fromOrganizer;

  /*
    The gate. `loadEventGroup` returns null for an event with no group, and
    that is a hard stop rather than a fallback to "invite anyone": an event
    without a group has nobody who consented, so it has nobody to invite.
  */
  const { loadEventGroup } = await import("@/lib/groups");
  const group = await loadEventGroup(event.id);
  if (!group) return { errors: { _form: copy.invites.noGroupTitle } };

  const consented = new Set(invitableMembers(group.members).map((member) => member.userId));
  if (picked.some((userId) => !consented.has(userId))) {
    return { errors: { _form: copy.invites.errorNotInGroup } };
  }

  // Somebody who already answered does not get asked again — the panel hides
  // them, but a stale page can still submit them.
  const alreadyOn = new Set(
    (await loadInvitations(event.id)).filter((row) => row.answered).map((row) => row.userId),
  );

  /*
    Addresses enter the picture here and nowhere earlier: read from the
    accounts these people verified, at the moment of sending, and never stored.

    Two reasons not to write to somebody, and they are different. `alreadyOn`
    is a courtesy: they answered, so asking again is noise. The suppression
    list is not a courtesy — it is somebody who told us to stop, and it
    outranks even a group membership, because "I am in your group" is not "keep
    emailing me". It is checked here rather than at the port so the organizer
    can be told how many were skipped.
  */
  const { loadVerifiedEmails } = await import("@/lib/accounts");
  const addresses = await loadVerifiedEmails(picked);
  const optedOut = await suppressedAmong([...addresses.values()]);

  const toSend = picked
    .filter((userId) => !alreadyOn.has(userId))
    .map((userId) => ({ userId, email: addresses.get(userId) }))
    .filter((row): row is { userId: string; email: string } => {
      // No address means an account we cannot reach. Skipped rather than
      // failed: there is nothing the organizer could retry.
      return row.email !== undefined && !optedOut.has(row.email);
    });

  /*
    Claimed before anything is written, and counted per organizer rather than
    per event: the abuse this guards is one person emailing a crowd all
    afternoon, and spreading it across five events they created would otherwise
    cost them nothing. `MAX_INVITES_PER_SEND` caps one click; this caps the
    afternoon.
  */
  // `authorize` already required a session, so the organizer is present; the
  // event id is a fallback that can only be reached if that ever stops holding.
  const limitKey = `invite:${organizer?.id ?? event.id}`;
  const perHour = await getSetting("invitesPerHour");
  const allowance = await claimSends(limitKey, perHour, toSend.length);
  if (!allowance.ok) {
    return { errors: { _form: copy.invites.errorRateLimited(perHour) } };
  }

  if (toSend.length === 0) {
    return { errors: {}, ok: true, sent: 0, skipped: picked.length };
  }

  const rows = await db
    .insert(invitations)
    .values(
      toSend.map((row) => ({
        id: uuidv7(),
        eventId: event.id,
        userId: row.userId,
      })),
    )
    // A repeat is a resend, not a second row — the unique index on
    // (event_id, user_id) is what makes that true, and this is how inviting a
    // group twice stays one invitation each.
    .onConflictDoUpdate({
      target: [invitations.eventId, invitations.userId],
      set: { sentAt: new Date() },
    })
    /*
      The row's id IS the unsubscribe token, so the insert has to hand it back.
      `onConflictDoUpdate` rather than `DoNothing` for exactly this reason: a
      resend to somebody already invited must return the existing id, and
      `DoNothing` returns nothing at all for the rows it skipped.
    */
    .returning({ id: invitations.id, userId: invitations.userId });

  track(
    "invite_sent",
    { event_id: event.id, group_id: group.id, batch_size: toSend.length },
    organizer?.id ?? null,
  );

  // Built once for the batch: it is the same file for everybody, and the only
  // thing that varies per recipient is who it is addressed to.
  const calendar = await calendarAttachment(event);

  const results = await Promise.all(
    rows.map((row) => {
      const email = addresses.get(row.userId);
      if (!email) return Promise.resolve("skipped" as const);

      /*
        Through the outbox: the row is written before the send, so an
        invitation that never went out is findable instead of silent. The
        dedupe key is (template, recipient, event, trigger) — no trigger here,
        which is what makes a repeat of the same batch a no-op.
      */
      return enqueueAndSend({
        message: invitationMessage(event, organizerName, email, row.id, copy, calendar),
        eventId: event.id,
      });
    }),
  );

  // `duplicate` is not a failure: the message already exists and somebody
  // already dealt with it, which is the answer the organizer wants.
  const failed = results.filter((result) => result === "failed").length;


  return {
    errors: {},
    ok: true,
    sent: toSend.length - failed,
    skipped: picked.length - toSend.length,
    failed,
  };
}

/** Sends one invitation again, for somebody who has not answered. */
export async function resendInvitation(
  publicToken: string,
  organizerToken: string,
  invitationId: string,
): Promise<InviteState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const id = z.uuid().safeParse(invitationId);
  if (!id.success) return { errors: { _form: copy.errors.notFound } };

  // Scoped to this event, so an id from somewhere else finds nothing.
  const [row] = await db
    .select({
      id: invitations.id,
      userId: invitations.userId,
      participantId: invitations.participantId,
    })
    .from(invitations)
    .where(and(eq(invitations.id, id.data), eq(invitations.eventId, event.id)))
    .limit(1);

  if (!row) return { errors: { _form: copy.errors.notFound } };

  // Already answered — there is nothing left to invite them to.
  if (row.participantId !== null) return { errors: {}, ok: true, sent: 0, skipped: 1 };

  // The address, again read from the account rather than from the invitation.
  const { loadVerifiedEmails } = await import("@/lib/accounts");
  const email = (await loadVerifiedEmails([row.userId])).get(row.userId);
  if (!email) return { errors: {}, ok: true, sent: 0, skipped: 1 };

  // And a resend is still a send: somebody who unsubscribed does not get one
  // because an organizer pressed a button next to their name.
  if ((await suppressedAmong([email])).size > 0) {
    return { errors: {}, ok: true, sent: 0, skipped: 1 };
  }

  const organizer = await getOrganizer();
  const organizerName = organizer?.displayName ?? copy.invites.fromOrganizer;

  const calendar = await calendarAttachment(event);

  /*
    `trigger` is what makes a resend a second message rather than a duplicate
    the outbox swallows. Keyed on the attempt count, so pressing resend twice
    in a row genuinely sends twice — which is what the organizer just asked
    for — while a double-submitted click does not.
  */
  const result = await enqueueAndSend({
    message: invitationMessage(event, organizerName, email, row.id, copy, calendar),
    eventId: event.id,
    trigger: `resend:${Date.now()}`,
  });

  await db.update(invitations).set({ sentAt: new Date() }).where(eq(invitations.id, id.data));


  return result === "failed"
    ? { errors: { _form: copy.invites.errorSendFailed }, sent: 0, failed: 1 }
    : { errors: {}, ok: true, sent: 1 };
}

/** Removes a participant. The payment row goes with them, by cascade. */
export async function removeParticipant(
  publicToken: string,
  organizerToken: string,
  rawParticipantId: string,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const participantId = participantIdSchema.safeParse(rawParticipantId);
  if (!participantId.success) return { errors: { _form: copy.errors.notFound } };

  /*
    A state, not a deletion. The row used to be DELETEd here, and with it every
    fact a later dispute needs: that they were on the list, what they were
    asked for, whether money changed hands, when they left. Now "Quitar" is
    the organizer answering "out" on somebody's behalf — the person drops to
    the same "Se bajaron" list a self-dropout lands in, wearing a "Removido"
    pill so the two exits are never confused.

    `outAt` is coalesced, not overwritten: removing somebody who ALREADY left
    must not move the instant the refund policy judges them by — the notice
    was given when it was given.
  */
  await db
    .update(participants)
    .set({
      attendance: "out",
      outAt: sql`coalesce(${participants.outAt}, now())`,
      removedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(participants.id, participantId.data), eq(participants.eventId, event.id)));

  // Removing an attendee changes everybody else's share.
  await syncPayments(event);

  return { errors: {}, ok: true };
}

/**
 * Promotes a waitlisted participant onto the roster.
 *
 * Deliberately explicit. Capacity freeing up shows the organizer a prompt; it
 * never moves anyone by itself, because somebody silently promoted does not
 * know they are playing.
 */
export async function promoteParticipant(
  publicToken: string,
  organizerToken: string,
  rawParticipantId: string,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const participantId = participantIdSchema.safeParse(rawParticipantId);
  if (!participantId.success) return { errors: { _form: copy.errors.notFound } };

  await db
    .update(participants)
    .set({ attendance: "in", updatedAt: new Date() })
    .where(
      and(
        eq(participants.id, participantId.data),
        eq(participants.eventId, event.id),
        // Only a waitlisted row is promotable, so a double-submit cannot
        // resurrect somebody who has since said they are out.
        eq(participants.attendance, "waitlisted"),
      ),
    );

  await syncPayments(event);

  return { errors: {}, ok: true };
}

/** Freezes or unfreezes RSVPs. */
export async function setEventClosed(
  publicToken: string,
  organizerToken: string,
  closed: boolean,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  await db
    .update(events)
    .set({ closedAt: closed ? new Date() : null })
    .where(eq(events.id, event.id));

  track("event_closed", { event_id: event.id, closed });

  return { errors: {}, ok: true };
}

/**
 * Calls the event off, and tells everyone who was counting on it.
 *
 * **Not the same as closing, and the difference is the whole point.** Closing
 * freezes confirmations for an event that still happens. Cancelling says the
 * thing is off — which is what a calendar needs to hear before it will remove
 * the entry from everybody who added it, and what a person needs to hear
 * before they stop planning their Thursday around it.
 *
 * **Owner only.** Every other organizer power is delegable to whoever holds
 * the manage link, because running the day is delegable. Calling the event off
 * is not: it is the one action a co-organizer should not be able to take on
 * the owner's behalf, and it cannot be undone.
 *
 * **Payments are not touched.** Somebody who paid for an event that will not
 * happen is owed money by the organizer, and erasing the record of who paid
 * what would destroy the only evidence either of them has. Junti never held
 * that money and cannot refund it; what it can do is keep the count honest.
 */
/**
 * Moves the event off its date without calling it off.
 *
 * The third answer Ivan asked for, between going ahead and cancelling: an
 * organizer who sees the turnout is short can say "not that day" and keep
 * everything — roster, requirements, money already collected — while they
 * look for a new one. The people who confirmed hear about it immediately,
 * which is the entire point: the failure being prevented is somebody
 * travelling to an empty field.
 *
 * Reversible, unlike cancelling, so it takes a boolean. The usual way back is
 * not this toggle at all — `editEvent` clears the flag the moment the date
 * changes, because an organizer who picked a new day has resumed by
 * definition. The toggle is for changing one's mind without touching the date.
 *
 * Only the postponement announces. Resuming with the OLD date is the organizer
 * undoing their own click, usually within a minute, and a second round of
 * "actually it is back on" for something nobody had time to read is noise; the
 * announcement that matters — the new date — is `editEvent`'s to send.
 */
export async function setEventPostponed(
  publicToken: string,
  organizerToken: string,
  postponed: boolean,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const organizer = await getOrganizer();
  if (!organizer || organizer.id !== event.organizerId) {
    return { errors: { _form: copy.manage.editNotYours } };
  }

  // A cancelled event is over, and "postponed" is a promise about a future
  // this one no longer has.
  if (event.cancelledAt) return { errors: { _form: copy.errors.eventClosed } };

  // Already in the requested state: saying it twice would send a second round
  // of messages about something everybody already heard.
  if (Boolean(event.postponedAt) === postponed) return { errors: {}, ok: true };

  const postponedAt = postponed ? new Date() : null;
  const sequence = event.calendarSequence + 1;

  await db
    .update(events)
    .set({ postponedAt, calendarSequence: sequence })
    .where(eq(events.id, event.id));

  track("event_postponed", { event_id: event.id, postponed }, organizer.id);

  if (postponed) {
    await announceToAttendees(
      { ...event, postponedAt, calendarSequence: sequence },
      copy,
      "postpone",
    );
  }

  return { errors: {}, ok: true };
}

export async function cancelEvent(
  publicToken: string,
  organizerToken: string,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const organizer = await getOrganizer();
  if (!organizer || organizer.id !== event.organizerId) {
    return { errors: { _form: copy.manage.editNotYours } };
  }

  // Already off. Cancelling twice would send a second round of messages about
  // something everybody already heard about.
  if (event.cancelledAt) return { errors: {}, ok: true };

  const cancelledAt = new Date();
  const sequence = event.calendarSequence + 1;

  await db
    .update(events)
    .set({ cancelledAt, calendarSequence: sequence })
    .where(eq(events.id, event.id));

  track("event_cancelled", { event_id: event.id }, organizer.id);

  /*
    Told after the fact is recorded, and outside any transaction. The event
    being cancelled is the fact; a provider having a bad minute must not undo
    it, and a message that failed to send is recoverable in a way that a
    half-cancelled event is not.
  */
  await announceToAttendees({ ...event, cancelledAt, calendarSequence: sequence }, copy, "cancel");

  return { errors: {}, ok: true };
}

/**
 * The messages, and the calendar file that empties the slot.
 *
 * Sent only to people who said they were coming. Somebody who answered "no"
 * already made other plans, and somebody who never answered was never counting
 * on it — writing to either is noise about a thing they had already let go of.
 *
 * **One function for both endings**, because the machinery is identical and
 * only the words differ: who to reach, an inbox row per person, verified
 * addresses, who has money recorded, and a CANCEL calendar file — a date that
 * will not happen has to leave the calendar whether the plan died or merely
 * moved. Two copies of this drifted apart the moment one of them was fixed;
 * the `kind` picks the notification type, the template and the trigger, and
 * everything else is shared by construction.
 */
async function announceToAttendees(
  event: EventRow,
  copy: Copy,
  kind: "cancel" | "postpone",
): Promise<void> {
  const [{ loadVerifiedEmails }, { calendarAttachment }, { formatEventDateTime }] =
    await Promise.all([
      import("@/lib/accounts"),
      import("@/lib/calendar"),
      import("@/lib/format"),
    ]);

  const attending = await db
    .select({ userId: participants.userId, participantId: participants.id })
    .from(participants)
    .where(and(eq(participants.eventId, event.id), eq(participants.attendance, "in")));

  const userIds = attending.map((row) => row.userId).filter((id): id is string => id !== null);
  if (userIds.length === 0) return;

  /*
    The in-app copy goes to the same list, from the same call — which is the
    card's guidance about the two channels made literal. An email that lands in
    spam and an inbox that says nothing is the failure mode this closes; whoever
    reads either one learns the same thing.

    Written before the sends rather than after, because the sends are the part
    that can take seconds and fail, and the row costs nothing.
  */
  const { record } = await import("@/lib/notifications");
  const owner = await getOrganizer();

  await record(
    userIds.map((userId) => ({
      userId,
      type: kind === "cancel" ? ("event_cancelled" as const) : ("event_postponed" as const),
      eventId: event.id,
    })),
    owner?.id ?? null,
  );

  const addresses = await loadVerifiedEmails(userIds);

  // Who has money recorded against this event, so the note about refunds only
  // reaches the people it concerns. Inventing a debt for somebody who owes
  // nothing is its own kind of alarming.
  const paid = new Set(
    (
      await db
        .select({ participantId: payments.participantId })
        .from(payments)
        .innerJoin(participants, eq(participants.id, payments.participantId))
        .where(and(eq(participants.eventId, event.id), eq(payments.status, "confirmed")))
    ).map((row) => row.participantId),
  );

  const calendar = await calendarAttachment(event, "CANCEL");
  const when = formatEventDateTime(event.startsAt, event.timeZone, copy.intlLocale);

  await Promise.all(
    attending.map((row) => {
      const email = row.userId ? addresses.get(row.userId) : undefined;
      if (!email) return Promise.resolve("failed" as const);

      return notify(
        {
          to: email,
          template: kind === "cancel" ? "event-cancelled" : "event-postponed",
          locale: event.locale,
          attachments: calendar ? [calendar] : undefined,
          values: {
            eventTitle: event.title,
            eventWhen: when,
            eventPath: participantPath(event.publicToken),
            hadPaid: paid.has(row.participantId) ? "1" : "",
          },
        },
        { eventId: event.id, trigger: kind },
      );
    }),
  );
}

/**
 * Whether this event's details may be changed, and by whom.
 *
 * Editing is the one organizer power reserved for the OWNER. Everything else —
 * payments, invitations, the waitlist, closing — a delegate holding the manage
 * link can do, because running the day is what the link is for and gating that
 * behind ownership would make it useless.
 *
 * What changed is the failure mode. This used to return false for an event with
 * no owner at all, whose details were then fixed forever; every event has an
 * owner now, so the only way to be refused is to not be them.
 */
async function mayEdit(event: EventRow): Promise<boolean> {
  const organizer = await getOrganizer();
  return organizer !== null && organizer.id === event.organizerId;
}

/** Edits the event details, then re-splits in case the cost changed. */
export async function editEvent(
  publicToken: string,
  organizerToken: string,
  formData: FormData,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  // Re-checked here and not merely hidden in the UI: the panel is reachable by
  // anyone holding the link, so the form's absence is a courtesy and this is
  // the rule.
  if (!(await mayEdit(event))) {
    return { errors: { _form: copy.manage.editNotYours } };
  }

  const parsed = makeEventSchema(copy).safeParse({
    title: field(formData, "title"),
    eventTypeId: field(formData, "eventTypeId"),
    startsAtDate: field(formData, "startsAtDate"),
    startsAtTime: field(formData, "startsAtTime"),
    timeZone: field(formData, "timeZone") || event.timeZone,
    locale: field(formData, "locale") || event.locale,
    location: field(formData, "location"),
    capacity: field(formData, "capacity"),
    minAttendees: field(formData, "minAttendees"),
    rsvpLead: field(formData, "rsvpLead"),
    notes: field(formData, "notes"),
    costMode: field(formData, "costMode"),
    costAmount: field(formData, "costAmount"),
    currency: field(formData, "currency") || event.currency,
    refundNotice: field(formData, "refundNotice"),
    groupId: field(formData, "groupId"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;

  /*
    A currency change is refused once money has actually moved.

    The stored amounts are integers in the OLD currency's minor units, and a
    confirmed payment is a fact about the past — 25.000 pesos handed over do
    not become 25.000 of anything else because the label changed. Pending
    rows would re-split fine, but the confirmed ones would sit in the ledger
    denominated in a currency the event no longer speaks, and every total on
    the money summary would quietly add pesos to dollars. The UI disables the
    picker in this state; this is the rule for whoever bypasses the UI.
  */
  if (input.currency !== event.currency) {
    const [confirmedPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .innerJoin(participants, eq(participants.id, payments.participantId))
      .where(and(eq(participants.eventId, event.id), eq(payments.status, "confirmed")))
      .limit(1);

    if (confirmedPayment) {
      return { errors: { currency: copy.errors.currencyLocked } };
    }
  }

  /*
    Same ownership check as creation, and it matters more here: an event can
    be edited with the manage link alone, by a co-organizer who owns no groups
    at all. Only the account that owns a group may point an event at it.
  */
  // Hoisted: both the group check and the analytics event below need to know
  // who is editing, and a co-organizer working purely from the manage link is
  // legitimately nobody.
  const editor = await getOrganizer();

  let groupId: string | null = null;
  if (input.groupId) {
    const { loadOwnedGroups } = await import("@/lib/groups");
    const owned = editor ? await loadOwnedGroups(editor.id) : [];

    if (!owned.some((group) => group.id === input.groupId)) {
      return { errors: { groupId: copy.errors.notFound } };
    }
    groupId = input.groupId;
  }

  const policies = parsePoliciesField(field(formData, "policies"), copy);
  if (!policies.ok) return { errors: { _form: policies.message } };

  /*
    What actually moved, worked out before the write while the old row is still
    in hand. It answers two questions at once: which fields to name in the
    notification, and what to record as `changed` — which is what `ANALYTICS.md`
    has always said this event carries, against a `field_count` that only ever
    counted the size of the form.
  */
  const changed = changedFields(event, {
    title: input.title,
    startsAt: input.startsAt,
    location: input.location,
    capacity: input.capacity,
    rsvpDeadline: input.rsvpDeadline,
    costMode: input.costMode,
    costAmountMinor: input.costAmountMinor,
  });

  await db
    .update(events)
    .set({
      title: input.title,
      eventTypeId: input.eventTypeId,
      startsAt: input.startsAt,
      timeZone: input.timeZone,
      locale: input.locale,
      location: input.location,
      capacity: input.capacity,
      minAttendees: input.minAttendees,
      rsvpDeadline: input.rsvpDeadline,
      notes: input.notes,
      /*
        A new date IS the resumption. An organizer who postponed and has now
        picked a day has already done the thing the flag was waiting for, and
        leaving "aplazado" over a fresh date would be the app contradicting
        itself on its own page. The `event_updated` notification below carries
        the new date, so this needs no announcement of its own — one message,
        not two.

        Only when the date actually moved: re-saving the form to fix a typo in
        the title must not quietly un-postpone the event.
      */
      postponedAt:
        event.postponedAt && input.startsAt.getTime() !== event.startsAt.getTime()
          ? null
          : event.postponedAt,
      costMode: input.costMode,
      costAmountMinor: input.costAmountMinor,
      currency: input.currency,
      refundNoticeHours: input.refundNotice,
      groupId,
      // Calendars ignore an update that does not claim to be newer. See the
      // column's note in the schema.
      calendarSequence: event.calendarSequence + 1,
    })
    .where(eq(events.id, event.id));

  // Field names, never values: which fields an organizer goes back to change
  // is the question; what they changed them to is their business.
  track("event_edited", { event_id: event.id, changed }, editor?.id ?? null);

  // Only the people who are counting on it, and only when something they would
  // recognise has moved. See `changedFields` for what is deliberately not on
  // that list.
  if (changed.length > 0) await announceUpdate(event.id, changed, editor?.id ?? null);

  await reconcilePolicies(event.id, policies.value);

  // Re-read so syncPayments splits against the new cost, not the old one.
  const updated = await authorize(publicToken, organizerToken);
  if (updated) await syncPayments(updated);

  return { errors: {}, ok: true };
}

/**
 * Tells the people who are counting on this event that it moved.
 *
 * **Only those who said they are coming**, which is the same rule
 * {@link announceCancellation} uses and for the same reason: somebody who
 * answered "no" made other plans, and somebody who never answered was never
 * holding the slot. A "maybe" is the arguable one — they get nothing, because a
 * change to a plan you have not committed to is not news, and the event page
 * has the current details whenever they come back to decide.
 *
 * Waitlisted people are told. They are waiting on this exact slot, and a
 * reschedule is precisely what would make them stop waiting.
 */
async function announceUpdate(
  eventId: string,
  changed: ChangedField[],
  actorId: string | null,
): Promise<void> {
  const { record } = await import("@/lib/notifications");

  const affected = await db
    .select({ userId: participants.userId })
    .from(participants)
    .where(
      and(
        eq(participants.eventId, eventId),
        inArray(participants.attendance, ["in", "waitlisted"]),
      ),
    );

  await record(
    affected
      .map((row) => row.userId)
      .filter((id): id is string => id !== null)
      .map((userId) => ({
        userId,
        type: "event_updated" as const,
        eventId,
        payload: { changed },
      })),
    actorId,
  );
}

/**
 * Approves or rejects a submitted receipt.
 *
 * This is the act the whole policy feature exists for: somebody said they are
 * coming and sent proof, and a human decides whether it counts. Approving is
 * what moves them out of the pending section and into the confirmed list.
 *
 * A rejection carries the reason back to the participant, who can then send
 * another. It does not delete the submission — the row is reused, so the roster
 * shows one standing per policy rather than a pile of attempts.
 */
export async function reviewSubmission(
  publicToken: string,
  organizerToken: string,
  rawSubmissionId: string,
  rawDecision: string,
  rawReason?: string,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const parsed = reviewSubmissionSchema.safeParse({
    submissionId: rawSubmissionId,
    decision: rawDecision,
    reviewNote: rawReason ?? "",
  });

  if (!parsed.success) return { errors: { _form: copy.errors.notFound } };

  // Scoped to this event, so an organizer cannot judge a submission that
  // belongs to somebody else's event by passing its id.
  const submission = await findSubmissionInEvent(
    event.id,
    parsed.data.submissionId,
    await resolveEventLocale(event.locale),
  );
  if (!submission) return { errors: { _form: copy.errors.notFound } };

  await db
    .update(policySubmissions)
    .set({
      status: parsed.data.decision,
      // Only meaningful on a rejection; cleared on approval so an old reason
      // cannot resurface if the participant sends something else later.
      reviewNote: parsed.data.decision === "rejected" ? parsed.data.reviewNote : null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(policySubmissions.id, submission.id));

  /*
    An approved receipt is deleted, and the approval is what survives.

    A photograph of somebody's banking app has exactly one purpose: convincing
    the organizer they paid. The moment that is settled it stops being evidence
    and becomes a liability sitting in a database with no backups — the SAME
    database the whole product runs on, where receipts are the only thing that
    consumes real space. COSTS.md puts the ceiling at ~1,500 of them.

    Only on approval. A rejection means the participant has to send something
    else, and destroying what they sent would leave them arguing about an image
    nobody can look at any more.

    Irreversible on purpose, and worth knowing: an organizer who approves by
    mistake cannot go back and look. The submission row still says who sent
    what and when, which is the part a dispute actually turns on.
  */
  if (parsed.data.decision === "approved") await deleteEvidence(submission.id);

  /*
    Approving a PAYMENT receipt is receiving the payment — one act, not two.

    Ivan approved Elias's comprobante and then watched "Cuentas" insist
    nothing had been collected, because approval only settled the policy
    while the money waited for a separate "Pagó" tap the flow never pointed
    at. For the one policy whose evidence IS the transfer (`proof_of_payment`
    by slug), the approval now confirms the payment at the amount the ledger
    was asking — the quota — exactly as pressing "Pagó" would. Other
    policies ("Leí las indicaciones") keep money and compliance apart, as
    they should: reading the rules is not paying.

    Confirmed-only-if-pending: an organizer who already recorded a different
    amount by hand is not overwritten by a review click.
  */
  if (parsed.data.decision === "approved" && submission.policySlug === "proof_of_payment") {
    await syncPayments(event);
    const confirmed = await db
      .update(payments)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(
        and(eq(payments.participantId, submission.participantId), eq(payments.status, "pending")),
      )
      .returning({ amountMinor: payments.amountMinor, creditApplied: payments.creditAppliedMinor });

    /*
      The same credit spend that "Pagó" does. Approving a receipt and marking
      the payment by hand are two doors into one act, and a credit that only
      one of them honoured would make the two disagree about what somebody
      still owes.
    */
    if (confirmed[0] && confirmed[0].creditApplied === 0) {
      const [{ spendCreditsOnConfirm }, [participant]] = await Promise.all([
        import("@/lib/credits"),
        db
          .select({ userId: participants.userId })
          .from(participants)
          .where(eq(participants.id, submission.participantId))
          .limit(1),
      ]);

      await spendCreditsOnConfirm({
        participantId: submission.participantId,
        userId: participant?.userId ?? null,
        organizerId: event.organizerId,
        currency: event.currency,
        askMinor: confirmed[0].amountMinor,
      });
    }
  }

  // The decision, not the reason. A rejection reason is free text somebody
  // typed about another person.
  track("policy_reviewed", { event_id: event.id, decision: parsed.data.decision });

  return { errors: {}, ok: true };
}

/**
 * Brings the event's policies in line with what the organizer submitted.
 *
 * Three cases, and the distinction between the first two is the reason
 * `PolicyEditor` sends ids back:
 *
 * - **A row that returns with its id** is updated in place. Fixing a typo in a
 *   label must not throw away the receipts already approved against it.
 * - **A row with no id** is new.
 * - **A row that does not come back** is deleted, and its submissions go with
 *   it by cascade. That is the honest reading of removing a requirement: it no
 *   longer exists, so neither does anyone's standing on it.
 *
 * Position is taken from the order they arrive in, so reordering is just
 * resubmitting the list.
 */
async function reconcilePolicies(
  eventId: string,
  submitted: {
    id?: string;
    definitionId: string;
    label: string | null;
    description: string | null;
  }[],
): Promise<void> {
  const keptIds = submitted.map((policy) => policy.id).filter((id): id is string => Boolean(id));

  await db.transaction(async (tx) => {
    // Anything the organizer dropped. `notInArray` with an empty list matches
    // nothing in SQL, so the empty case is handled separately.
    if (keptIds.length > 0) {
      await tx
        .delete(eventPolicies)
        .where(and(eq(eventPolicies.eventId, eventId), notInArray(eventPolicies.id, keptIds)));
    } else {
      await tx.delete(eventPolicies).where(eq(eventPolicies.eventId, eventId));
    }

    // Only ids that really belong to this event survive, so a forged id cannot
    // reach across to another organizer's policy.
    const existing = keptIds.length
      ? new Set(
          (
            await tx
              .select({ id: eventPolicies.id })
              .from(eventPolicies)
              .where(and(eq(eventPolicies.eventId, eventId), inArray(eventPolicies.id, keptIds)))
          ).map((row) => row.id),
        )
      : new Set<string>();

    for (const [index, policy] of submitted.entries()) {
      if (policy.id && existing.has(policy.id)) {
        await tx
          .update(eventPolicies)
          .set({ label: policy.label, description: policy.description, position: index })
          .where(eq(eventPolicies.id, policy.id));
      } else {
        await tx.insert(eventPolicies).values({
          id: uuidv7(),
          eventId,
          policyDefinitionId: policy.definitionId,
          label: policy.label,
          description: policy.description,
          position: index,
        });
      }
    }
  });
}

/**
 * Records that a confirmed payer handed over the difference their risen share
 * asked for — the settlement's one write.
 *
 * The payment STAYS confirmed and only the amount moves up to the current
 * computed share. This is not rewriting history: the amount on a confirmed
 * row has always meant "what the organizer says they received in total", and
 * receiving the top-up raises that total. Going through pending instead
 * (mark-owing then re-confirm) would erase the original amount on the way —
 * `planLedger` rewrites pending rows to the computed share — which destroys
 * the one record of the first payment.
 *
 * Guarded to only ever move UP to the computed share: a top-up cannot shrink
 * a payment, and cannot outrun the split.
 */
export async function reconcilePayment(
  publicToken: string,
  organizerToken: string,
  rawParticipantId: string,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const participantId = participantIdSchema.safeParse(rawParticipantId);
  if (!participantId.success) return { errors: { _form: copy.errors.notFound } };

  const { loadRoster } = await import("@/lib/roster");
  const { resolveEventLocale: resolveLocale } = await import("@/lib/locale");
  const roster = await loadRoster(event, await resolveLocale(event.locale));

  const member = roster.members.find((m) => m.id === participantId.data);
  if (!member || member.share.status !== "confirmed") {
    return { errors: { _form: copy.errors.notFound } };
  }

  const target = member.share.computedAmountMinor;
  if (target === member.share.effectiveAmountMinor) {
    // Already square — a stale button somebody else already pressed.
    return { errors: {}, ok: true };
  }

  /*
    One write for both directions, and the acceptance is cleared with it: the
    drift this row was carrying no longer exists, so a stored "leave it as it
    is" would be an agreement about nothing, waiting to silence the next
    genuine drift of the same size.
  */
  await db
    .update(payments)
    .set({ amountMinor: target, discrepancyAcceptedMinor: null })
    .where(and(eq(payments.participantId, participantId.data), eq(payments.status, "confirmed")));

  return { errors: {}, ok: true };
}

/**
 * Moves somebody's surplus into what the organizer owes them next time.
 *
 * The answer that makes the other two bearable. Ten people each owed $4.333
 * is ten Nequi transfers nobody is going to make, so the money stays with the
 * organizer either way — the only question is whether the app remembers whose
 * it is. This makes it remember, and spends it automatically the next time
 * those two share an event.
 *
 * Reconciles the payment in the same breath, and that pairing is the point:
 * the peso leaves this event's books exactly as it enters the person's
 * balance, so it is never counted twice.
 */
export async function creditSurplus(
  publicToken: string,
  organizerToken: string,
  rawParticipantId: string,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const participantId = participantIdSchema.safeParse(rawParticipantId);
  if (!participantId.success) return { errors: { _form: copy.errors.notFound } };

  const { loadRoster } = await import("@/lib/roster");
  const { resolveEventLocale: resolveLocale } = await import("@/lib/locale");
  const roster = await loadRoster(event, await resolveLocale(event.locale));

  const member = roster.members.find((m) => m.id === participantId.data);
  if (!member || member.share.status !== "confirmed" || member.share.discrepancyMinor <= 0) {
    return { errors: { _form: copy.errors.notFound } };
  }

  // A credit belongs to an ACCOUNT. Somebody with no session has nowhere to
  // carry it to, and inventing one would be a debt to nobody.
  if (!member.userId) return { errors: { _form: copy.errors.notFound } };

  const { creditOverpayment } = await import("@/lib/credits");

  await creditOverpayment({
    userId: member.userId,
    organizerId: event.organizerId,
    amountMinor: member.share.discrepancyMinor,
    currency: event.currency,
    originEventId: event.id,
  });

  await db
    .update(payments)
    .set({ amountMinor: member.share.computedAmountMinor, discrepancyAcceptedMinor: null })
    .where(and(eq(payments.participantId, participantId.data), eq(payments.status, "confirmed")));

  track("credit_granted", { event_id: event.id });

  return { errors: {}, ok: true };
}

/**
 * Records that this drift is fine as it is.
 *
 * The third answer, and the one the app used to have no room for: among
 * friends "que quede para las cervezas" settles a surplus as legitimately as
 * handing it back, and an organizer who decides that should not be asked
 * again every time they open the panel.
 *
 * Stores the AMOUNT agreed to, never a flag — see the column. Accepting
 * $4.333 says nothing about the $8.000 the same person might be owed after
 * three more people join, and that one deserves its own decision.
 */
export async function acceptDiscrepancy(
  publicToken: string,
  organizerToken: string,
  rawParticipantId: string,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const participantId = participantIdSchema.safeParse(rawParticipantId);
  if (!participantId.success) return { errors: { _form: copy.errors.notFound } };

  const { loadRoster } = await import("@/lib/roster");
  const { resolveEventLocale: resolveLocale } = await import("@/lib/locale");
  const roster = await loadRoster(event, await resolveLocale(event.locale));

  const member = roster.members.find((m) => m.id === participantId.data);
  if (!member || member.share.status !== "confirmed" || member.share.discrepancyMinor === 0) {
    return { errors: { _form: copy.errors.notFound } };
  }

  await db
    .update(payments)
    .set({ discrepancyAcceptedMinor: member.share.discrepancyMinor })
    .where(and(eq(payments.participantId, participantId.data), eq(payments.status, "confirmed")));

  return { errors: {}, ok: true };
}

/**
 * Emails every attendee who still owes part of the dropout gap, asking for it.
 *
 * **Fired by a button, never by a clock.** Whether to chase the gap before
 * the event (the roster clearly is not filling) or after it (it did not fill)
 * is the organizer's read of their own group, so the app's whole contribution
 * is doing the asking in one press instead of eight WhatsApp messages. The
 * recipients and the amounts are exactly the settlement card's top-up rows —
 * the organizer has read the list they are about to write to.
 *
 * Suppression is honoured inside `notify`, as everywhere: "stop writing to
 * me" beats "you owe $4.000". The dedupe trigger carries the day, so a
 * double-press sends nothing twice but a genuine second round — chasing again
 * a week later — goes out.
 */
export async function requestSettlement(
  publicToken: string,
  organizerToken: string,
): Promise<ManageState & { sent?: number }> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const [{ loadRoster }, { computeSettlement }, { loadVerifiedEmails }, { formatMoney }] =
    await Promise.all([
      import("@/lib/roster"),
      import("@/domain/settlement"),
      import("@/lib/accounts"),
      import("@/lib/format"),
    ]);

  const roster = await loadRoster(event, await resolveEventLocale(event.locale));

  const attendanceOf = new Map(roster.members.map((m) => [m.id, m.attendance]));
  const settlement = computeSettlement(
    roster.members.map((m) => m.share),
    (id) => attendanceOf.get(id) ?? "out",
  );

  if (settlement.topUps.length === 0) return { errors: {}, ok: true, sent: 0 };

  const membersById = new Map(roster.members.map((m) => [m.id, m]));
  const userIds = settlement.topUps
    .map((topUp) => membersById.get(topUp.participantId)?.userId)
    .filter((id): id is string => Boolean(id));

  const addresses = await loadVerifiedEmails(userIds);
  const money = (minor: number) => formatMoney(minor, event.currency, copy.intlLocale);

  // The day, not the instant: a double-press dedupes, a later round sends.
  const round = new Date().toISOString().slice(0, 10);

  const results = await Promise.all(
    settlement.topUps.map((topUp) => {
      const userId = membersById.get(topUp.participantId)?.userId;
      const email = userId ? addresses.get(userId) : undefined;
      if (!email) return Promise.resolve("failed" as const);

      return notify(
        {
          to: email,
          template: "settlement-request",
          locale: event.locale,
          values: {
            eventTitle: event.title,
            paidAmount: money(topUp.paidMinor),
            finalShare: money(topUp.finalShareMinor),
            missingAmount: money(topUp.missingMinor),
            eventPath: participantPath(event.publicToken),
          },
        },
        { eventId: event.id, trigger: `settlement:${round}` },
      );
    }),
  );

  const sent = results.filter((result) => result === "sent").length;

  track("settlement_requested", {
    event_id: event.id,
    owed: settlement.topUps.length,
    sent,
  });

  return { errors: {}, ok: true, sent };
}
