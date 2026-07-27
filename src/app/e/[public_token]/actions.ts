"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { uuidv7 } from "uuidv7";

import { copy } from "@/config/copy";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { resolveAttendance } from "@/domain/waitlist";
import { syncPayments } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findEventByPublicToken, loadParticipantRows } from "@/lib/roster";
import { EDIT_COOKIE_MAX_AGE, editCookieName } from "@/lib/rsvp-cookie";
import { createEditToken } from "@/lib/tokens";
import { participantPath } from "@/lib/urls";
import { field, fieldErrors, rsvpSchema } from "@/lib/validation";

export type RsvpState = {
  errors: Record<string, string>;
  /** Set when the submission was accepted onto the waitlist rather than the roster. */
  waitlisted?: boolean;
};

/** Twenty RSVP submissions an hour per IP covers a whole group sharing one wifi. */
const RSVP_LIMIT = 20;
const RSVP_WINDOW_MS = 60 * 60_000;

/**
 * Records or amends an RSVP.
 *
 * Identity is the display name, case-insensitively unique per event. A device
 * that has RSVP'd before carries an edit token in a cookie, which lets it amend
 * its own row; without that cookie, submitting an existing name is treated as a
 * collision rather than silently taking over somebody else's entry.
 */
export async function submitRsvp(
  publicToken: string,
  _previous: RsvpState,
  formData: FormData,
): Promise<RsvpState> {
  const ip = clientIp(await headers());
  const limit = rateLimit(`rsvp:${ip}`, RSVP_LIMIT, RSVP_WINDOW_MS);

  if (!limit.ok) {
    return { errors: { _form: copy.errors.rateLimited } };
  }

  const event = await findEventByPublicToken(publicToken);
  if (!event) {
    return { errors: { _form: copy.errors.notFound } };
  }

  if (event.closedAt !== null) {
    return { errors: { _form: copy.errors.eventClosed } };
  }

  const parsed = rsvpSchema.safeParse({
    displayName: field(formData, "displayName"),
    attendance: field(formData, "attendance"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { displayName, attendance: requested } = parsed.data;

  const cookieStore = await cookies();
  const cookieName = editCookieName(event.id);
  const editToken = cookieStore.get(cookieName)?.value ?? null;

  const rows = await loadParticipantRows(event.id);
  const rosterForCapacity = rows.map((row) => ({
    id: row.participant.id,
    joinedAt: row.participant.createdAt,
    attendance: row.participant.attendance,
  }));

  // The row this device already owns, if any.
  const owned = editToken
    ? (rows.find((row) => row.participant.editToken === editToken)?.participant ?? null)
    : null;

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
      .set({ displayName, attendance, updatedAt: new Date() })
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
