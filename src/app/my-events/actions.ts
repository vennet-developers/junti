"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uuidv7 } from "uuidv7";

import { ROUTES } from "@/config/routes";
import { db } from "@/db/client";
import { eventPolicies, events } from "@/db/schema";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { nextWeekStart } from "@/lib/recurrence";
import { createOrganizerToken, createPublicToken } from "@/lib/tokens";
import { eventIdSchema } from "@/lib/validation";

export type DuplicateState = { error?: string; ok?: boolean };

/**
 * Copies an event for the week after it, in one tap.
 *
 * Built for the fixture that repeats — five-a-side every Thursday — where
 * everything except the date is identical and retyping it is the whole friction.
 *
 * Only the account the event is attributed to may do this, and the copy is
 * attributed to them too. New tokens: a duplicate is a different event, and
 * reusing the links would put two rosters behind one URL.
 */
export async function duplicateEvent(rawEventId: string): Promise<DuplicateState> {
  const { copy } = await getViewerCopy();

  const organizer = await getOrganizer();
  if (!organizer) return { error: copy.errors.signInRequired };

  const eventId = eventIdSchema.safeParse(rawEventId);
  if (!eventId.success) return { error: copy.errors.notFound };

  // Scoped by owner, so an id belonging to somebody else finds nothing.
  const [source] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId.data), eq(events.organizerId, organizer.id)))
    .limit(1);

  if (!source) return { error: copy.errors.notFound };

  const startsAt = nextWeekStart(source.startsAt);

  /**
   * A double tap on a phone is one gesture, and it would otherwise be two
   * identical events. Same owner, same title, same instant is not something
   * anybody means twice.
   */
  const [clash] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.organizerId, organizer.id),
        eq(events.title, source.title),
        eq(events.startsAt, startsAt),
      ),
    )
    .limit(1);

  if (clash) return { error: copy.auth.duplicateExists };

  const newId = uuidv7();

  await db.transaction(async (tx) => {
    await tx.insert(events).values({
      id: newId,
      publicToken: createPublicToken(),
      organizerToken: createOrganizerToken(),
      organizerId: organizer.id,
      title: source.title,
      eventTypeId: source.eventTypeId,
      startsAt,
      timeZone: source.timeZone,
      locale: source.locale,
      location: source.location,
      capacity: source.capacity,
      notes: source.notes,
      costMode: source.costMode,
      costAmountMinor: source.costAmountMinor,
      currency: source.currency,
    });

    // The requirements come along; the submissions against them do not. A new
    // week is a new round of proving you paid.
    const policies = await tx
      .select({
        policyDefinitionId: eventPolicies.policyDefinitionId,
        label: eventPolicies.label,
        description: eventPolicies.description,
        position: eventPolicies.position,
      })
      .from(eventPolicies)
      .where(eq(eventPolicies.eventId, source.id));

    if (policies.length > 0) {
      await tx.insert(eventPolicies).values(
        policies.map((policy) => ({
          id: uuidv7(),
          eventId: newId,
          policyDefinitionId: policy.policyDefinitionId,
          label: policy.label,
          description: policy.description,
          position: policy.position,
        })),
      );
    }
  });

  revalidatePath(ROUTES.myEvents);

  return { ok: true };
}
