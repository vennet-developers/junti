"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { uuidv7 } from "uuidv7";

import { getCopy } from "@/config/copy";
import type { Copy } from "@/config/copy";
import { db } from "@/db/client";
import { eventPolicies, participants, policyDefinitions, policySubmissions } from "@/db/schema";
import { findHandler, initialStatusFor } from "@/domain/policy-handlers";
import { resolveAttendance } from "@/domain/waitlist";
import { checkEvidence, EVIDENCE_MAX_BYTES, putEvidence } from "@/lib/evidence-store";
import { resolveEventLocale } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { syncPayments } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findEventByPublicToken, loadParticipantRows } from "@/lib/roster";
import { EDIT_COOKIE_MAX_AGE, editCookieName } from "@/lib/rsvp-cookie";
import { createEditToken } from "@/lib/tokens";
import { participantPath } from "@/lib/urls";
import {
  field,
  fieldErrors,
  makeRsvpSchema,
  makeSubmissionNoteSchema,
  policyIdSchema,
} from "@/lib/validation";

export type RsvpState = {
  errors: Record<string, string>;
  /** Set when the submission was accepted onto the waitlist rather than the roster. */
  waitlisted?: boolean;
};

/** Twenty RSVP submissions an hour per IP covers a whole group sharing one wifi. */
const RSVP_LIMIT = 20;
const RSVP_WINDOW_MS = 60 * 60_000;

/** Uploads are heavier, and nobody legitimately sends thirty receipts an hour. */
const SUBMISSION_LIMIT = 30;
const SUBMISSION_WINDOW_MS = 60 * 60_000;

/**
 * The strings for the language THIS event is being read in.
 *
 * Server actions have no React context, so the language is resolved per call
 * from the same cookie and event the page used. Getting this wrong is how an
 * error message comes back in the other language from the form it appears in.
 */
async function eventCopy(eventLocale: string): Promise<Copy> {
  return getCopy(await resolveEventLocale(eventLocale));
}

/**
 * Records or amends an RSVP.
 *
 * Identity is the display name, case-insensitively unique per event. A device
 * that has RSVP'd before carries an edit token in a cookie, which lets it amend
 * its own row; a signed-in person is matched on their account instead, which is
 * what lets them change their answer from a different phone.
 */
export async function submitRsvp(
  publicToken: string,
  _previous: RsvpState,
  formData: FormData,
): Promise<RsvpState> {
  const ip = clientIp(await headers());
  const limit = rateLimit(`rsvp:${ip}`, RSVP_LIMIT, RSVP_WINDOW_MS);

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }

  const copy = await eventCopy(event.locale);

  if (!limit.ok) {
    return { errors: { _form: copy.errors.rateLimited } };
  }

  if (event.closedAt !== null) {
    return { errors: { _form: copy.errors.eventClosed } };
  }

  const parsed = makeRsvpSchema(copy).safeParse({
    displayName: field(formData, "displayName"),
    attendance: field(formData, "attendance"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { displayName, attendance: requested } = parsed.data;

  const organizer = await getOrganizer();

  const cookieStore = await cookies();
  const cookieName = editCookieName(event.id);
  const editToken = cookieStore.get(cookieName)?.value ?? null;

  const rows = await loadParticipantRows(event.id);
  const rosterForCapacity = rows.map((row) => ({
    id: row.participant.id,
    joinedAt: row.participant.createdAt,
    attendance: row.participant.attendance,
  }));

  // The row this person already owns: by account first, because that survives
  // a new device, then by the cookie this browser is carrying.
  const owned =
    (organizer
      ? (rows.find((row) => row.participant.userId === organizer.id)?.participant ?? null)
      : null) ??
    (editToken
      ? (rows.find((row) => row.participant.editToken === editToken)?.participant ?? null)
      : null);

  const nameClash = rows.find(
    (row) =>
      row.participant.displayName.toLocaleLowerCase("es-CO") ===
        displayName.toLocaleLowerCase("es-CO") && row.participant.id !== owned?.id,
  );

  if (nameClash) {
    return { errors: { displayName: copy.rsvp.duplicateName } };
  }

  const attendance = resolveAttendance({
    requested,
    capacity: event.capacity,
    participants: rosterForCapacity,
    existing: owned?.attendance ?? null,
  });

  if (owned) {
    await db
      .update(participants)
      .set({
        displayName,
        attendance,
        // Claims the row for the account if they signed in after RSVPing on
        // this device. Never clears it: signing out does not orphan the entry.
        ...(organizer && !owned.userId
          ? { userId: organizer.id, avatarUrl: organizer.avatarUrl }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(participants.id, owned.id), eq(participants.eventId, event.id)));
  } else {
    const newEditToken = createEditToken();

    try {
      await db.insert(participants).values({
        id: uuidv7(),
        eventId: event.id,
        displayName,
        attendance,
        editToken: newEditToken,
        userId: organizer?.id ?? null,
        avatarUrl: organizer?.avatarUrl ?? null,
      });
    } catch {
      // The unique index on (event_id, lower(display_name)) is the real
      // guard — two people submitting the same name at the same moment both
      // pass the check above and one loses here.
      return { errors: { displayName: copy.rsvp.duplicateName } };
    }

    cookieStore.set(cookieName, newEditToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: participantPath(publicToken),
      maxAge: EDIT_COOKIE_MAX_AGE,
    });
  }

  await syncPayments(event);
  revalidatePath(participantPath(publicToken));

  return { errors: {}, waitlisted: attendance === "waitlisted" };
}

/**
 * Joins the event in one tap, for somebody already signed in.
 *
 * Takes no name and no form: the session already knows who they are, which is
 * the entire point — the RSVP form exists because anonymous participants have
 * to introduce themselves, and a signed-in one does not.
 *
 * The one thing that can still go wrong is a name collision, because display
 * names are unique per event and somebody may already be on the roster as
 * "Ivan". That is reported rather than worked around: silently joining as
 * "Ivan (2)" would put a name on the list that the person never chose and
 * would not recognise.
 */
export async function joinOneTap(publicToken: string): Promise<RsvpState> {
  const ip = clientIp(await headers());
  const limit = rateLimit(`rsvp:${ip}`, RSVP_LIMIT, RSVP_WINDOW_MS);

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }

  const copy = await eventCopy(event.locale);

  if (!limit.ok) return { errors: { _form: copy.errors.rateLimited } };
  if (event.closedAt !== null) return { errors: { _form: copy.errors.eventClosed } };

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  const rows = await loadParticipantRows(event.id);

  // Already here — nothing to do, and saying so beats a duplicate-name error.
  if (rows.some((row) => row.participant.userId === organizer.id)) {
    revalidatePath(participantPath(publicToken));
    return { errors: {} };
  }

  const displayName = organizer.displayName.slice(0, 40);

  const clash = rows.some(
    (row) =>
      row.participant.displayName.toLocaleLowerCase("es-CO") ===
      displayName.toLocaleLowerCase("es-CO"),
  );

  if (clash) {
    return { errors: { _form: copy.rsvp.oneTapNameTaken, nameTaken: "1" } };
  }

  const attendance = resolveAttendance({
    requested: "in",
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
      displayName,
      attendance,
      editToken: createEditToken(),
      userId: organizer.id,
      avatarUrl: organizer.avatarUrl,
    });
  } catch {
    return { errors: { _form: copy.rsvp.oneTapNameTaken, nameTaken: "1" } };
  }

  await syncPayments(event);
  revalidatePath(participantPath(publicToken));

  return { errors: {}, waitlisted: attendance === "waitlisted" };
}

export type SubmissionState = { errors: Record<string, string>; done?: boolean };

/**
 * Responds to one of the event's policies.
 *
 * Two shapes behind one action, because from the participant's side they are
 * the same act — doing what the event asked:
 *
 * - an **acknowledgement** is settled immediately, since ticking the box is the
 *   whole of what was asked;
 * - **proof of payment** is stored as `submitted` and waits for the organizer,
 *   because an image is a claim somebody has to actually look at.
 *
 * Re-submitting after a rejection reuses the same row, so the roster shows one
 * standing per policy rather than a history of attempts.
 */
export async function submitPolicyResponse(
  publicToken: string,
  _previous: SubmissionState,
  formData: FormData,
): Promise<SubmissionState> {
  const ip = clientIp(await headers());
  const limit = rateLimit(`policy:${ip}`, SUBMISSION_LIMIT, SUBMISSION_WINDOW_MS);

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }

  const copy = await eventCopy(event.locale);

  if (!limit.ok) return { errors: { _form: copy.errors.rateLimited } };
  if (event.closedAt !== null) return { errors: { _form: copy.errors.eventClosed } };

  const policyId = policyIdSchema.safeParse(field(formData, "policyId"));
  if (!policyId.success) return { errors: { _form: copy.errors.notFound } };

  // Scoped to this event, so a policy id from somewhere else finds nothing.
  // The handler comes from the catalogue, which is what decides both what this
  // submission must carry and who settles it — never the client.
  const [policy] = await db
    .select({ id: eventPolicies.id, handler: policyDefinitions.handler })
    .from(eventPolicies)
    .innerJoin(policyDefinitions, eq(policyDefinitions.id, eventPolicies.policyDefinitionId))
    .where(and(eq(eventPolicies.id, policyId.data), eq(eventPolicies.eventId, event.id)))
    .limit(1);

  if (!policy) return { errors: { _form: copy.errors.notFound } };

  const handler = findHandler(policy.handler);

  // A catalogue row naming a behaviour this build does not implement. There is
  // no control for it, so reaching here means a hand-made request.
  if (!handler) return { errors: { _form: copy.errors.notFound } };

  const participant = await findMyParticipantRow(event.id);
  if (!participant) return { errors: { _form: copy.errors.forbidden } };

  const note = makeSubmissionNoteSchema().parse(field(formData, "note"));

  // The image is read and checked BEFORE the submission row is written, so a
  // rejected upload leaves nothing behind to clean up.
  let evidence: { mimeType: string; bytes: Buffer } | null = null;

  if (handler.evidence === "image") {
    const file = formData.get("evidence");

    if (!(file instanceof File) || file.size === 0) {
      return { errors: { evidence: copy.errors.evidenceRequired } };
    }

    const checked = checkEvidence(await file.arrayBuffer());

    if (!checked.ok) {
      const message = {
        too_large: copy.errors.evidenceTooLarge(Math.round(EVIDENCE_MAX_BYTES / 1000)),
        wrong_type: copy.errors.evidenceWrongType,
        unreadable: copy.errors.evidenceUnreadable,
      }[checked.reason];

      return { errors: { evidence: message } };
    }

    evidence = { mimeType: checked.mimeType, bytes: checked.bytes };
  }

  const status = initialStatusFor(handler);
  const now = new Date();

  const [row] = await db
    .insert(policySubmissions)
    .values({
      id: uuidv7(),
      policyId: policy.id,
      participantId: participant.id,
      status,
      note,
      // A fresh attempt, so any previous verdict is cleared rather than left
      // to contradict the new submission.
      reviewNote: null,
      reviewedAt: status === "approved" ? now : null,
    })
    .onConflictDoUpdate({
      target: [policySubmissions.policyId, policySubmissions.participantId],
      set: {
        status,
        note,
        reviewNote: null,
        reviewedAt: status === "approved" ? now : null,
        updatedAt: now,
      },
    })
    .returning({ id: policySubmissions.id });

  if (evidence && row) {
    await putEvidence(row.id, evidence);
  }

  revalidatePath(participantPath(publicToken));

  return { errors: {}, done: true };
}

/**
 * The participant row belonging to whoever is asking — by account, else by the
 * edit-token cookie this browser holds.
 *
 * Never takes a participant id from the request. Doing so would let anyone
 * holding the public link submit a receipt as somebody else.
 */
async function findMyParticipantRow(eventId: string) {
  const organizer = await getOrganizer();

  if (organizer) {
    const [byAccount] = await db
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.eventId, eventId), eq(participants.userId, organizer.id)))
      .limit(1);

    if (byAccount) return byAccount;
  }

  const editToken = (await cookies()).get(editCookieName(eventId))?.value;
  if (!editToken) return null;

  const [byCookie] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.editToken, editToken)))
    .limit(1);

  return byCookie ?? null;
}
