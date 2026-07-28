"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { uuidv7 } from "uuidv7";

import { copy } from "@/config/copy";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getOrganizer } from "@/lib/organizer";
import { createOrganizerToken, createPublicToken } from "@/lib/tokens";
import { eventSchema, field, fieldErrors } from "@/lib/validation";

/**
 * A `"use server"` module may only export async functions, so the initial state
 * for `useActionState` is declared in the client component rather than here.
 */
export type CreateEventState = {
  errors: Record<string, string>;
};

/** Six new events per hour per IP is far past what a real organizer needs. */
const CREATE_LIMIT = 6;
const CREATE_WINDOW_MS = 60 * 60_000;

/**
 * Creates an event and sends the organizer to their control panel.
 *
 * There is no login, so the two tokens generated here are the only access that
 * will ever exist for this event. The organizer token is put in the redirect
 * URL and nowhere else.
 */
export async function createEvent(
  _previous: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const ip = clientIp(await headers());
  const limit = rateLimit(`create-event:${ip}`, CREATE_LIMIT, CREATE_WINDOW_MS);

  if (!limit.ok) {
    return { errors: { _form: copy.errors.rateLimited } };
  }

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
    currency: field(formData, "currency") || "COP",
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const input = parsed.data;
  const publicToken = createPublicToken();
  const organizerToken = createOrganizerToken();

  // Attribute the event when someone is signed in, so it shows up in their
  // history. Creating anonymously still works — that is the original flow and
  // the tokens remain the access path either way.
  const organizer = await getOrganizer();

  await db.insert(events).values({
    organizerId: organizer?.id ?? null,
    id: uuidv7(),
    publicToken,
    organizerToken,
    title: input.title,
    kind: input.kind,
    startsAt: input.startsAt,
    location: input.location,
    capacity: input.capacity,
    notes: input.notes,
    costMode: input.costMode,
    costAmountMinor: input.costAmountMinor,
    currency: input.currency,
  });

  // redirect() throws to unwind, so it must be outside the try/catch above and
  // is never reached on a validation failure.
  redirect(`/e/${publicToken}/manage/${organizerToken}?created=1`);
}
