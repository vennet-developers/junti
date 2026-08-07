import "@/server/assert-server";

import { and, eq, isNull } from "drizzle-orm";
import { getRequest } from "@tanstack/react-start/server";
import { uuidv7 } from "uuidv7";

import { getCopy } from "@/config/copy";
import type { Copy } from "@/config/copy";
import { db } from "@/db/client";
import {
  heldSpots,
  eventNotes,
  eventPolicies,
  participants,
  policyDefinitions,
  policySubmissions,
} from "@/db/schema";
import type { EventRow } from "@/db/schema";
import {
  NOTE_MAX,
  canDeleteCommitment,
  checkCommitment,
} from "@/domain/commitments";
import { canAnswer } from "@/domain/convocation";
import { holdProblem } from "@/domain/held-spots";
import { findHandler, initialStatusFor } from "@/domain/policy-handlers";
import { resolveAttendance } from "@/domain/waitlist";
import { checkEvidence, EVIDENCE_MAX_BYTES, putEvidence } from "@/lib/evidence-store";
import { formatEventDateTime, formatMoney } from "@/lib/format";
import { resolveEventLocale } from "@/lib/locale";
import { notify } from "@/lib/notify";
import { getOrganizer } from "@/lib/organizer";
import { isAlreadyJoined, isNameTaken } from "@/lib/db-errors";
import { syncPayments } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  findEventByPublicToken,
  linkInvitationToParticipant,
  loadParticipantRows,
} from "@/lib/roster";
import { participantPath } from "@/lib/urls";
import { track } from "@/lib/analytics";
import { calendarAttachment } from "@/lib/calendar";
import {
  field,
  fieldErrors,
  makeRsvpSchema,
  makeSubmissionNoteSchema,
  policyIdSchema,
} from "@/lib/validation";

export type RsvpState = {
  errors: Record<string, string>;
  /** Set when the action succeeded and the caller wants to say so. */
  ok?: boolean;
  /** Set when the submission was accepted onto the waitlist rather than the roster. */
  waitlisted?: boolean;
};

/**
 * Why this write cannot happen, in the reader's language, or null to go ahead.
 *
 * Two guards, and which one a path uses is a product decision rather than a
 * detail. `stopped` is "the event itself is off or frozen" and applies to
 * everything. `answersClosed` adds the convocation deadline, and applies ONLY
 * to the paths that say whether you are coming — somebody who already said yes
 * has not stopped coming because the headcount is settled, so their receipt and
 * the thing they promised to bring are still accepted afterwards.
 *
 * Cancelled counts as stopped for every write: an event that is not happening
 * must not take new answers, and the banner above the form has already said why.
 */
function stopped(event: EventRow, copy: Copy): string | null {
  if (event.cancelledAt !== null || event.closedAt !== null) return copy.errors.eventClosed;
  return null;
}

function answersClosed(event: EventRow, copy: Copy): string | null {
  const stop = stopped(event, copy);
  if (stop) return stop;
  return canAnswer(event, new Date()) ? null : copy.errors.rsvpDeadlinePassed;
}

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
 * Identity is the account, and the display name is the PROFILE's — copied on
 * every write, never a per-event field. Ivan's rule in one sentence: "el
 * nombre es lo que ponga el usuario en su perfil". The per-event name box
 * used to exist for "the group knows me by another name"; it cost a field on
 * every answer and a second identity to maintain, and the profile page is
 * where a name is edited now. Still unique per event so the roster reads
 * cleanly; a clash tells the person to adjust their profile.
 */
export async function submitRsvp(publicToken: string, formData: FormData): Promise<RsvpState> {
  const ip = clientIp(getRequest().headers);
  const limit = rateLimit(`rsvp:${ip}`, RSVP_LIMIT, RSVP_WINDOW_MS);

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }

  const copy = await eventCopy(event.locale);

  if (!limit.ok) {
    return { errors: { _form: copy.errors.rateLimited } };
  }

  const shut = answersClosed(event, copy);
  if (shut) return { errors: { _form: shut } };

  const parsed = makeRsvpSchema(copy).safeParse({
    attendance: field(formData, "attendance"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { attendance: requested } = parsed.data;

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  // The profile IS the name — never a per-event field. Same trim as one-tap.
  const displayName = organizer.displayName.slice(0, 40);

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
    return { errors: { _form: copy.rsvp.duplicateName } };
  }

  const attendance = resolveAttendance({
    requested,
    capacity: event.capacity,
    participants: rosterForCapacity,
    existing: owned?.attendance ?? null,
  });

  // Read before the write, because "did the answer change" is the whole test
  // for whether the organizer hears about this at all.
  const wasAttending = owned?.attendance ?? null;

  if (owned) {
    await db
      .update(participants)
      .set({
        displayName,
        attendance,
        /*
          Evidence for the refund policy: stamped on the way INTO "out",
          cleared on the way back in, untouched when an "out" row is amended
          without changing its answer — the notice was given when it was
          given, and fixing a typo in your name must not move it.
        */
        ...(attendance === "out"
          ? wasAttending === "out"
            ? {}
            : { outAt: new Date() }
          : { outAt: null }),
        // A fresh answer is theirs. Whatever the organizer decided about the
        // old one ("Quitar" stamps this), the person speaking for themselves
        // clears it — the "Removido" pill must never outlive the removal.
        removedAt: null,
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
        // A first answer of "no voy" is still an answer given at an instant.
        outAt: attendance === "out" ? new Date() : null,
        userId: organizer.id,
        avatarUrl: organizer.avatarUrl,
      });
    } catch {
      // The unique index on (event_id, lower(display_name)) is the real
      // guard — two people submitting the same name at the same moment both
      // pass the check above and one loses here.
      return { errors: { _form: copy.rsvp.duplicateName } };
    }

    // Closes the loop for somebody who got here from an invitation email, so
    // the organizer's list stops showing them as still waiting.
    await linkInvitationToParticipant(event.id, organizer.id, id);
    await sendRsvpReceipt(event, organizer, attendance, copy);
  }

  await syncPayments(event);

  /*
    Only when the answer itself moved. Somebody correcting the spelling of
    their own name, or re-submitting the same form, is not news — and an inbox
    that fills with "Ana: Voy" three times because Ana was fixing a typo is one
    people learn to ignore, which costs the notifications that do matter.
  */
  if (attendance !== wasAttending) {
    await tellOrganizer(event, displayName, attendance, organizer.id);
  }

  track(
    "rsvp_completed",
    { event_id: event.id, attendance, one_tap: false, waitlisted: attendance === "waitlisted" },
    organizer.id,
  );

  return { errors: {}, waitlisted: attendance === "waitlisted" };
}

/**
 * Tells the organizer somebody answered.
 *
 * The one notification the whole feature is really for: an organizer's day is
 * built out of who is coming, and until now the only way to learn it was to
 * open the panel and look.
 *
 * `record` drops a notification addressed to whoever caused it, so an organizer
 * answering their own event is silently skipped here rather than guarded at
 * every call.
 */
async function tellOrganizer(
  event: EventRow,
  displayName: string,
  attendance: string,
  actorId: string,
): Promise<void> {
  const { record } = await import("@/lib/notifications");

  await record(
    [
      {
        userId: event.organizerId,
        type: "rsvp_received",
        eventId: event.id,
        payload: { name: displayName, attendance },
      },
    ],
    actorId,
  );
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
  const ip = clientIp(getRequest().headers);
  const limit = rateLimit(`rsvp:${ip}`, RSVP_LIMIT, RSVP_WINDOW_MS);

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }

  const copy = await eventCopy(event.locale);

  if (!limit.ok) return { errors: { _form: copy.errors.rateLimited } };

  const shut = answersClosed(event, copy);
  if (shut) return { errors: { _form: shut } };

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  const rows = await loadParticipantRows(event.id);

  // Already here — nothing to do, and saying so beats a duplicate-name error.
  if (rows.some((row) => row.participant.userId === organizer.id)) {
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
  } catch (error) {
    /*
      Two different unique indexes can fire here, and they mean opposite things.

      `participants_event_user_unique` means this account is already on the
      roster — a double tap, or a second tab. The row the caller wanted exists,
      so this is a success: reporting "that name is taken" would send somebody
      who is already going to a form to pick a different name, which is both
      wrong and alarming. The read above catches the common case; this catches
      the one where two taps raced past it.

      `participants_event_name_unique` is the real collision: somebody else on
      this roster already goes by the name on this account.
    */
    if (isAlreadyJoined(error)) {
      return { errors: {} };
    }

    if (isNameTaken(error)) {
      return { errors: { _form: copy.rsvp.oneTapNameTaken, nameTaken: "1" } };
    }

    // Neither index: something else went wrong and the row was not written.
    // Saying "you're on the list" here would be a lie with consequences.
    throw error;
  }

  await linkInvitationToParticipant(event.id, organizer.id, id);
  await sendRsvpReceipt(event, organizer, attendance, copy);
  await syncPayments(event);
  await tellOrganizer(event, displayName, attendance, organizer.id);

  track(
    "rsvp_completed",
    { event_id: event.id, attendance, one_tap: true, waitlisted: attendance === "waitlisted" },
    organizer.id,
  );

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

  // Only for somebody who is actually coming. A waitlisted entry in a calendar
  // would block a slot for something that may never happen.
  const calendar = attendance === "in" ? await calendarAttachment(event) : undefined;

  await notify({
    to: organizer.email,
    template: "rsvp-confirmed",
    locale: event.locale,
    attachments: calendar ? [calendar] : undefined,
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
  formData: FormData,
): Promise<SubmissionState> {
  const ip = clientIp(getRequest().headers);
  const limit = rateLimit(`policy:${ip}`, SUBMISSION_LIMIT, SUBMISSION_WINDOW_MS);

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }

  const copy = await eventCopy(event.locale);

  if (!limit.ok) return { errors: { _form: copy.errors.rateLimited } };
  // `stopped`, not `answersClosed`: the convocation deadline settles the
  // headcount, and somebody who is already on it can still send the photo of
  // their transfer afterwards.
  const shut = stopped(event, copy);
  if (shut) return { errors: { _form: shut } };

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

  /*
    Only what somebody has to look at. An acknowledgement settles itself — the
    tick was the whole of what was asked — and telling the organizer that a box
    was ticked is a notification with no action behind it.

    This is also the one type with no email behind it: the `pending-approval`
    template exists and has never had a call site. The two channels are meant to
    agree, and right now they agree by both being quiet; wiring the email is a
    separate decision about how much mail an organizer wants, and the in-app
    inbox is the cheaper half to be wrong about.
  */
  if (status === "submitted") {
    const { record } = await import("@/lib/notifications");

    await record(
      [
        {
          userId: event.organizerId,
          type: "approval_pending",
          eventId: event.id,
          payload: { name: participant.displayName },
        },
      ],
      participant.userId,
    );
  }

  track("policy_submitted", { event_id: event.id, status, has_evidence: Boolean(evidence) });

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

  // The name comes back too: it is what the organizer's notification says, and
  // the roster's copy of it is the one this event knows this person by.
  const [row] = await db
    .select({
      id: participants.id,
      displayName: participants.displayName,
      userId: participants.userId,
    })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.userId, organizer.id)))
    .limit(1);

  return row ?? null;
}

/** Thirty edits an hour: enough to fix a typo, not enough to flood a feed. */
const COMMITMENT_LIMIT = 30;
const COMMITMENT_WINDOW_MS = 60 * 60_000;

/**
 * Finds the reader's own row on this event, or null.
 *
 * Every commitment action is scoped through this: you can only speak as
 * somebody who is actually on the roster, and only as yourself. The organizer
 * token is not accepted here — an organizer who is not a participant has
 * nothing to commit to bringing.
 */
async function ownParticipant(eventId: string, userId: string) {
  const [row] = await db
    .select({ id: participants.id, attendance: participants.attendance })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.userId, userId)))
    .limit(1);

  return row ?? null;
}

/**
 * Saves what somebody is bringing, or updates it.
 *
 * Upsert on the participant rather than insert: there is one note per person
 * and editing it is the expected path, so a second save is a correction rather
 * than a second line in the feed contradicting the first.
 */
export async function saveCommitment(publicToken: string, formData: FormData): Promise<RsvpState> {
  const ip = clientIp(getRequest().headers);
  const limit = rateLimit(`commitment:${ip}`, COMMITMENT_LIMIT, COMMITMENT_WINDOW_MS);

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }

  const copy = await eventCopy(event.locale);

  if (!limit.ok) return { errors: { _form: copy.errors.rateLimited } };
  // `stopped`, like the policy path above: what you are bringing is a note from
  // somebody already on the roster, and it is normal to settle it after the
  // headcount is closed.
  const shut = stopped(event, copy);
  if (shut) return { errors: { _form: shut } };

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  const mine = await ownParticipant(event.id, organizer.id);
  if (!mine) return { errors: { _form: copy.commitments.mustJoinFirst } };

  const check = checkCommitment({
    note: field(formData, "note"),
    reaction: field(formData, "reaction"),
  });

  if (!check.ok || !check.value) {
    const message = {
      empty: copy.commitments.errorEmpty,
      "too-long": copy.commitments.errorTooLong(NOTE_MAX),
      "unknown-reaction": copy.commitments.errorReaction,
    }[check.problem ?? "empty"];

    return { errors: { _form: message } };
  }

  await db
    .insert(eventNotes)
    .values({
      id: uuidv7(),
      eventId: event.id,
      participantId: mine.id,
      note: check.value.note,
      reaction: check.value.reaction,
    })
    .onConflictDoUpdate({
      target: eventNotes.participantId,
      set: { note: check.value.note, reaction: check.value.reaction, updatedAt: new Date() },
    });

  return { errors: {}, ok: true };
}

/**
 * Removes a note — the author's own, or anybody's if the reader owns the event.
 *
 * The permission decision is `canDeleteCommitment`, which is pure and tested;
 * this resolves the two identities it needs and then does what it says.
 */
export async function deleteCommitment(
  publicToken: string,
  noteId: string,
): Promise<RsvpState> {
  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }

  const copy = await eventCopy(event.locale);

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  // Scoped by event id: a note id from another event must not be reachable.
  const [note] = await db
    .select({ id: eventNotes.id, participantId: eventNotes.participantId })
    .from(eventNotes)
    .where(and(eq(eventNotes.id, noteId), eq(eventNotes.eventId, event.id)))
    .limit(1);

  if (!note) return { errors: {} };

  const mine = await ownParticipant(event.id, organizer.id);

  const allowed = canDeleteCommitment({
    authorParticipantId: note.participantId,
    readerParticipantId: mine?.id ?? null,
    readerIsOrganizer: event.organizerId === organizer.id,
  });

  if (!allowed) return { errors: { _form: copy.errors.notAllowed } };

  await db.delete(eventNotes).where(eq(eventNotes.id, note.id));

  return { errors: {}, ok: true };
}

/**
 * Hold up to N seats for people the caller is bringing.
 *
 * **Holding is answering**, so `answersClosed` gates it exactly like the
 * "¿vienes?" — the convocatoria deadline included: reserving three seats
 * after the call closed would be answering for three people after the answer
 * shut. The claim, by contrast, stays open (see the claim route): the seat is
 * already counted, and a claim only changes whose name is on it.
 *
 * Names are optional and are the ONLY personal datum taken. No email field
 * exists on purpose — the claim link goes out by the sponsor's own WhatsApp,
 * which keeps the product's standing promise: nadie recibe correos de alguien
 * a quien nunca le dijo que sí.
 */
export async function holdSpots(publicToken: string, formData: FormData): Promise<RsvpState> {
  const ip = clientIp(getRequest().headers);
  const limit = rateLimit(`hold:${ip}`, RSVP_LIMIT, RSVP_WINDOW_MS);

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }
  const copy = await eventCopy(event.locale);
  if (!limit.ok) return { errors: { _form: copy.errors.rateLimited } };

  const shut = answersClosed(event, copy);
  if (shut) return { errors: { _form: shut } };

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  const mine = await ownParticipant(event.id, organizer.id);
  if (!mine) return { errors: { _form: copy.heldSpots.mustJoinFirst } };

  const requested = Number(field(formData, "count"));
  if (!Number.isInteger(requested) || requested < 1) {
    return { errors: { _form: copy.errors.notAllowed } };
  }

  const [{ getSetting }, { createClaimToken }] = await Promise.all([
    import("@/lib/settings"),
    import("@/lib/tokens"),
  ]);

  const rows = await loadParticipantRows(event.id);
  const spots = await db
    .select()
    .from(heldSpots)
    .where(and(eq(heldSpots.sponsorParticipantId, mine.id), isNull(heldSpots.claimedBy)));

  /*
    Weighted capacity, the same arithmetic the roster renders: every sponsor's
    unclaimed spots count as seats, so holding into the last slots is checked
    against what is genuinely left and not against a headcount.
  */
  const allSpots = await db
    .select({ sponsor: heldSpots.sponsorParticipantId })
    .from(heldSpots)
    .where(and(eq(heldSpots.eventId, event.id), isNull(heldSpots.claimedBy)));
  const heldBy = new Map<string, number>();
  for (const spot of allSpots) heldBy.set(spot.sponsor, (heldBy.get(spot.sponsor) ?? 0) + 1);

  const { openSlots } = await import("@/domain/waitlist");
  const slots = openSlots(
    event.capacity,
    rows.map((row) => ({
      id: row.participant.id,
      joinedAt: row.participant.createdAt,
      attendance: row.participant.attendance,
      weight: 1 + (heldBy.get(row.participant.id) ?? 0),
    })),
  );

  const maxHeldSpots = await getSetting("maxHeldSpots");
  const problem = holdProblem(requested, {
    attendance: mine.attendance,
    alreadyHeld: spots.length,
    openSlots: slots,
    maxHeldSpots,
  });

  if (problem !== null) {
    const message =
      problem === "not_attending"
        ? copy.heldSpots.mustJoinFirst
        : problem === "over_allowance"
          ? copy.heldSpots.overAllowance(maxHeldSpots)
          : copy.heldSpots.overCapacity;
    return { errors: { _form: message } };
  }

  /*
    Names arrive as `name-0` … `name-{n-1}`. Blank is fine — the roster
    renders "Invitado de {sponsor}" — and anything typed is trimmed and
    capped like a display name.
  */
  const values = Array.from({ length: requested }, (_, index) => {
    const raw = field(formData, `name-${index}`).trim().slice(0, 40);
    return {
      id: uuidv7(),
      eventId: event.id,
      sponsorParticipantId: mine.id,
      guestName: raw.length > 0 ? raw : null,
      claimToken: createClaimToken(),
    };
  });

  await db.insert(heldSpots).values(values);

  // Held seats weigh on the sponsor's bill now — the ledger must hear.
  await syncPayments(event);

  track("spot_held", { event_id: event.id, count: requested }, organizer.id);
  return { errors: {}, ok: true };
}

/** Release one of the caller's own unclaimed spots. */
export async function releaseSpot(publicToken: string, formData: FormData): Promise<RsvpState> {
  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: getCopy(await resolveEventLocale("es")).errors.notFound } };
  }
  const copy = await eventCopy(event.locale);

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };
  const mine = await ownParticipant(event.id, organizer.id);
  if (!mine) return { errors: { _form: copy.errors.notAllowed } };

  const spotId = field(formData, "spotId");

  /*
    Scoped to the caller's own UNCLAIMED spots in the predicate itself, so a
    guessed id deletes nothing and a claimed seat cannot be pulled out from
    under the person who claimed it.
  */
  await db
    .delete(heldSpots)
    .where(
      and(
        eq(heldSpots.id, spotId),
        eq(heldSpots.sponsorParticipantId, mine.id),
        isNull(heldSpots.claimedBy),
      ),
    );

  // A released seat stops weighing on the sponsor's bill.
  await syncPayments(event);

  return { errors: {}, ok: true };
}
