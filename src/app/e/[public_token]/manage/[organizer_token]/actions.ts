"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uuidv7 } from "uuidv7";

import { copy } from "@/config/copy";
import { db } from "@/db/client";
import { events, participants, payments } from "@/db/schema";
import type { EventRow } from "@/db/schema";
import { resolveAttendance } from "@/domain/waitlist";
import { syncPayments } from "@/lib/payments";
import { findEventByOrganizerToken, loadParticipantRows } from "@/lib/roster";
import { createEditToken } from "@/lib/tokens";
import { managePath, participantPath } from "@/lib/urls";
import {
  addParticipantSchema,
  eventSchema,
  field,
  fieldErrors,
  participantIdSchema,
  paymentStatusSchema,
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
  return findEventByOrganizerToken(publicToken, organizerToken);
}

function refresh(publicToken: string, organizerToken: string): void {
  revalidatePath(participantPath(publicToken));
  revalidatePath(managePath(publicToken, organizerToken));
}

const forbidden: ManageState = { errors: { _form: copy.errors.forbidden } };

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
  if (!event) return forbidden;

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
  if (!event) return forbidden;

  const parsed = addParticipantSchema.safeParse({
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
  if (!event) return forbidden;

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
  if (!event) return forbidden;

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
  if (!event) return forbidden;

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
  if (!event) return forbidden;

  const parsed = eventSchema.safeParse({
    title: field(formData, "title"),
    kind: field(formData, "kind"),
    startsAtDate: field(formData, "startsAtDate"),
    startsAtTime: field(formData, "startsAtTime"),
    location: field(formData, "location"),
    capacity: field(formData, "capacity"),
    notes: field(formData, "notes"),
    costMode: field(formData, "costMode"),
    costAmount: field(formData, "costAmount"),
    currency: field(formData, "currency") || event.currency,
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;

  await db
    .update(events)
    .set({
      title: input.title,
      kind: input.kind,
      startsAt: input.startsAt,
      location: input.location,
      capacity: input.capacity,
      notes: input.notes,
      costMode: input.costMode,
      costAmountMinor: input.costAmountMinor,
      currency: input.currency,
    })
    .where(eq(events.id, event.id));

  // Re-read so syncPayments splits against the new cost, not the old one.
  const updated = await authorize(publicToken, organizerToken);
  if (updated) await syncPayments(updated);

  refresh(publicToken, organizerToken);
  return { errors: {}, ok: true };
}
