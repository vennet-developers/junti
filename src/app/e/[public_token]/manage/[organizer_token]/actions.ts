"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uuidv7 } from "uuidv7";

import { getCopy } from "@/config/copy";
import type { Copy } from "@/config/copy";
import { db } from "@/db/client";
import { eventPolicies, events, participants, payments, policySubmissions } from "@/db/schema";
import type { EventRow } from "@/db/schema";
import { resolveAttendance } from "@/domain/waitlist";
import { resolveEventLocale } from "@/lib/locale";
import { syncPayments } from "@/lib/payments";
import { getOrganizer } from "@/lib/organizer";
import { authorizeOrganizer, findSubmissionInEvent, loadParticipantRows } from "@/lib/roster";
import { createEditToken } from "@/lib/tokens";
import { managePath, participantPath } from "@/lib/urls";
import {
  field,
  fieldErrors,
  makeAddParticipantSchema,
  makeEventSchema,
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
 * Loads the event only if the token pair is valid, and refreshes both views on
 * success. Returns null when the caller is not the organizer.
 */
async function authorize(publicToken: string, organizerToken: string): Promise<EventRow | null> {
  // Either the URL token or ownership of the event. Ownership comes from the
  // verified session, never from anything the client sends.
  const organizer = await getOrganizer();
  return authorizeOrganizer(publicToken, organizerToken, organizer?.id ?? null);
}

function refresh(publicToken: string, organizerToken: string): void {
  revalidatePath(participantPath(publicToken));
  revalidatePath(managePath(publicToken, organizerToken));
}

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
    .select({ id: participants.id })
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

  refresh(publicToken, organizerToken);
  return { errors: {}, ok: true };
}

/** Adds somebody manually — for the friend who never opens links. */
export async function addParticipant(
  publicToken: string,
  organizerToken: string,
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const parsed = makeAddParticipantSchema(copy).safeParse({
    displayName: field(formData, "displayName"),
    attendance: field(formData, "attendance"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const rows = await loadParticipantRows(event.id);

  const clash = rows.some(
    (row) =>
      row.participant.displayName.toLocaleLowerCase("es-CO") ===
      parsed.data.displayName.toLocaleLowerCase("es-CO"),
  );

  if (clash) return { errors: { displayName: copy.rsvp.duplicateName } };

  // The organizer adding somebody is still subject to capacity — otherwise the
  // waitlist would mean nothing and the roster could quietly exceed the cap.
  const attendance = resolveAttendance({
    requested: parsed.data.attendance,
    capacity: event.capacity,
    participants: rows.map((row) => ({
      id: row.participant.id,
      joinedAt: row.participant.createdAt,
      attendance: row.participant.attendance,
    })),
    existing: null,
  });

  try {
    await db.insert(participants).values({
      id: uuidv7(),
      eventId: event.id,
      displayName: parsed.data.displayName,
      attendance,
      editToken: createEditToken(),
    });
  } catch {
    return { errors: { displayName: copy.rsvp.duplicateName } };
  }

  await syncPayments(event);
  refresh(publicToken, organizerToken);

  return { errors: {}, ok: true };
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

  await db
    .delete(participants)
    .where(and(eq(participants.id, participantId.data), eq(participants.eventId, event.id)));

  // Removing an attendee changes everybody else's share.
  await syncPayments(event);
  refresh(publicToken, organizerToken);

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
  refresh(publicToken, organizerToken);

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

  refresh(publicToken, organizerToken);
  return { errors: {}, ok: true };
}

/** Edits the event details, then re-splits in case the cost changed. */
export async function editEvent(
  publicToken: string,
  organizerToken: string,
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const event = await authorize(publicToken, organizerToken);
  if (!event) return denied();

  const copy = await eventCopy(event.locale);

  const parsed = makeEventSchema(copy).safeParse({
    title: field(formData, "title"),
    kind: field(formData, "kind"),
    startsAtDate: field(formData, "startsAtDate"),
    startsAtTime: field(formData, "startsAtTime"),
    timeZone: field(formData, "timeZone") || event.timeZone,
    locale: field(formData, "locale") || event.locale,
    location: field(formData, "location"),
    capacity: field(formData, "capacity"),
    notes: field(formData, "notes"),
    costMode: field(formData, "costMode"),
    costAmount: field(formData, "costAmount"),
    currency: field(formData, "currency") || event.currency,
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const policies = parsePoliciesField(field(formData, "policies"), copy);
  if (!policies.ok) return { errors: { _form: policies.message } };

  const input = parsed.data;

  await db
    .update(events)
    .set({
      title: input.title,
      kind: input.kind,
      startsAt: input.startsAt,
      timeZone: input.timeZone,
      locale: input.locale,
      location: input.location,
      capacity: input.capacity,
      notes: input.notes,
      costMode: input.costMode,
      costAmountMinor: input.costAmountMinor,
      currency: input.currency,
    })
    .where(eq(events.id, event.id));

  await reconcilePolicies(event.id, policies.value);

  // Re-read so syncPayments splits against the new cost, not the old one.
  const updated = await authorize(publicToken, organizerToken);
  if (updated) await syncPayments(updated);

  refresh(publicToken, organizerToken);
  return { errors: {}, ok: true };
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
  const submission = await findSubmissionInEvent(event.id, parsed.data.submissionId);
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

  refresh(publicToken, organizerToken);
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
    kind: "proof_of_payment" | "acknowledgement";
    label: string;
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
          kind: policy.kind,
          label: policy.label,
          description: policy.description,
          position: index,
        });
      }
    }
  });
}
