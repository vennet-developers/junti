"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { uuidv7 } from "uuidv7";

import { getCopy } from "@/config/copy";
import type { Copy } from "@/config/copy";
import { db } from "@/db/client";
import { eventPolicies, participants, policyDefinitions, policySubmissions } from "@/db/schema";
import type { EventRow } from "@/db/schema";
import { findHandler, initialStatusFor } from "@/domain/policy-handlers";
import { resolveAttendance } from "@/domain/waitlist";
import { checkEvidence, EVIDENCE_MAX_BYTES, putEvidence } from "@/lib/evidence-store";
import { formatEventDateTime, formatMoney } from "@/lib/format";
import { resolveEventLocale } from "@/lib/locale";
import { notify } from "@/lib/notify";
import { getOrganizer } from "@/lib/organizer";
import { syncPayments } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  findEventByPublicToken,
  linkInvitationToParticipant,
  loadParticipantRows,
} from "@/lib/roster";
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
 * Identity is the account, and the display name is only a label — still unique
 * per event so the roster reads cleanly, but no longer the thing that says who
 * you are. That used to be reversed: the name was the identity and a cookie
 * carried the right to amend it, which meant your answer belonged to a browser
 * rather than to you.
 *
 * The form still exists because the name on a Google account is not always the
 * name a group knows you by. What it no longer does is let a stranger answer.
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
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  const rows = await loadParticipantRows(event.id);
  const rosterForCapacity = rows.map((row) => ({
    id: row.participant.id,
    joinedAt: row.participant.createdAt,
    attendance: row.participant.attendance,
  }));

  // The row this person already owns. One lookup, and it survives a new phone
  // or a cleared browser — neither of which the cookie it replaced did.
  const owned = rows.find((row) => row.participant.userId === organizer.id)?.participant ?? null;

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
        // Kept fresh on every amend: a photo changed on the Google account
        // should not leave last year's picture on the roster.
        avatarUrl: organizer.avatarUrl,
        updatedAt: new Date(),
      })
      .where(and(eq(participants.id, owned.id), eq(participants.eventId, event.id)));
  } else {
    const id = uuidv7();

    try {
      await db.insert(participants).values({
        id,
        eventId: event.id,
        displayName,
        attendance,
        userId: organizer.id,
        avatarUrl: organizer.avatarUrl,
      });
    } catch {
      // The unique index on (event_id, lower(display_name)) is the real
      // guard — two people submitting the same name at the same moment both
      // pass the check above and one loses here.
      return { errors: { displayName: copy.rsvp.duplicateName } };
    }

    // Closes the loop for somebody who got here from an invitation email, so
    // the organizer's list stops showing them as still waiting.
    await linkInvitationToParticipant(event.id, organizer.email, id);
    await sendRsvpReceipt(event, organizer, attendance, copy);
  }

  await syncPayments(event);
  revalidatePath(participantPath(publicToken));

  return { errors: {}, waitlisted: attendance === "waitlisted" };
}

/**
 * Joins the event in one tap, for somebody already signed in.
 *
 * Takes no name and no form: the session already knows who they are, which is
 * the entire point. The form is what remains for the person whose account name
 * is not what this group calls them.
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

  const id = uuidv7();

  try {
    await db.insert(participants).values({
      id,
      eventId: event.id,
      displayName,
      attendance,
      userId: organizer.id,
      avatarUrl: organizer.avatarUrl,
    });
  } catch {
    return { errors: { _form: copy.rsvp.oneTapNameTaken, nameTaken: "1" } };
  }

  await linkInvitationToParticipant(event.id, organizer.email, id);
  await sendRsvpReceipt(event, organizer, attendance, copy);
  await syncPayments(event);
  revalidatePath(participantPath(publicToken));

  return { errors: {}, waitlisted: attendance === "waitlisted" };
}

/**
 * The receipt for answering.
 *
 * Sent on a NEW answer only, never on an amendment: somebody flipping between
 * "voy" and "tal vez" while deciding does not want four emails about it, and a
 * receipt for a change is a notification, which is a different thing nobody
 * asked for.
 *
 * Only for the two outcomes worth a message. Saying you cannot come is not
 * something anybody needs mailed back to them.
 *
 * Failures are swallowed inside `notify`, deliberately: the RSVP is recorded
 * and must not be undone because a provider had a bad minute.
 */
async function sendRsvpReceipt(
  event: EventRow,
  organizer: { email: string | null },
  attendance: string,
  copy: Copy,
): Promise<void> {
  if (!organizer.email) return;
  if (attendance !== "in" && attendance !== "waitlisted") return;

  const share =
    event.costMode === "none" || event.costAmountMinor === null
      ? ""
      : formatMoney(event.costAmountMinor, event.currency, copy.intlLocale);

  await notify({
    to: organizer.email,
    template: "rsvp-confirmed",
    locale: event.locale,
    values: {
      eventTitle: event.title,
      eventWhen: formatEventDateTime(event.startsAt, event.timeZone, copy.intlLocale),
      eventWhere: event.location ?? "",
      // Only meaningful for a per-person cost; a total split among an unknown
      // number of people is not a figure this message can state honestly.
      amount: event.costMode === "per_person" ? share : "",
      attendance,
      eventPath: participantPath(event.publicToken),
    },
  });
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
 * The participant row belonging to whoever is asking, by account.
 *
 * Never takes a participant id from the request. Doing so would let anyone
 * holding the public link submit a receipt as somebody else — which matters
 * more here than anywhere: a receipt is what settles who has paid.
 */
async function findMyParticipantRow(eventId: string) {
  const organizer = await getOrganizer();
  if (!organizer) return null;

  const [row] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.userId, organizer.id)))
    .limit(1);

  return row ?? null;
}
