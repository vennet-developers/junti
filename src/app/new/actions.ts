"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { uuidv7 } from "uuidv7";

import { db } from "@/db/client";
import { eventPolicies, events } from "@/db/schema";
import { getViewerCopy } from "@/lib/locale";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getOrganizer } from "@/lib/organizer";
import { createOrganizerToken, createPublicToken } from "@/lib/tokens";
import { field, fieldErrors, makeEventSchema, parsePoliciesField } from "@/lib/validation";

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

  // The event does not exist yet, so there is no event language to defer to —
  // this one belongs to whoever is filling in the form.
  const { copy } = await getViewerCopy();

  if (!limit.ok) {
    return { errors: { _form: copy.errors.rateLimited } };
  }

  const parsed = makeEventSchema(copy).safeParse({
    title: field(formData, "title"),
    eventTypeId: field(formData, "eventTypeId"),
    startsAtDate: field(formData, "startsAtDate"),
    startsAtTime: field(formData, "startsAtTime"),
    timeZone: field(formData, "timeZone"),
    locale: field(formData, "locale"),
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

  const policies = parsePoliciesField(field(formData, "policies"), copy);

  if (!policies.ok) {
    return { errors: { _form: policies.message } };
  }

  const input = parsed.data;
  const publicToken = createPublicToken();
  const organizerToken = createOrganizerToken();

  // Attribute the event when someone is signed in, so it shows up in their
  // history. Creating anonymously still works — that is the original flow and
  // the tokens remain the access path either way.
  const organizer = await getOrganizer();
  const eventId = uuidv7();

  /**
   * The event and its policies land together or not at all.
   *
   * Without the transaction, a failure between the two inserts leaves an event
   * whose organizer chose requirements that silently do not exist — and the
   * roster would then confirm everybody.
   */
  await db.transaction(async (tx) => {
    await tx.insert(events).values({
      organizerId: organizer?.id ?? null,
      id: eventId,
      publicToken,
      organizerToken,
      title: input.title,
      eventTypeId: input.eventTypeId,
      startsAt: input.startsAt,
      timeZone: input.timeZone,
      locale: input.locale,
      location: input.location,
      capacity: input.capacity,
      notes: input.notes,
      costMode: input.costMode,
      costAmountMinor: input.costAmountMinor,
      currency: input.currency,
    });

    if (policies.value.length > 0) {
      await tx.insert(eventPolicies).values(
        policies.value.map((policy, index) => ({
          id: uuidv7(),
          eventId,
          policyDefinitionId: policy.definitionId,
          label: policy.label,
          description: policy.description,
          position: index,
        })),
      );
    }
  });

  // redirect() throws to unwind, so it must be outside the try/catch above and
  // is never reached on a validation failure.
  redirect(`/e/${publicToken}/manage/${organizerToken}?created=1`);
}
