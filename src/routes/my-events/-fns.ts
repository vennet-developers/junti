import { createServerFn } from "@tanstack/react-start";

export type DuplicateState = { error?: string; ok?: boolean };

/**
 * Copies an event for the week after it, in one tap.
 *
 * Successor of the `duplicateEvent` server action in
 * `src/app/my-events/actions.ts`, logic untouched. Built for the fixture that
 * repeats — five-a-side every Thursday — where everything except the date is
 * identical and retyping it is the whole friction.
 *
 * Only the account the event is attributed to may do this, and the copy is
 * attributed to them too. New tokens: a duplicate is a different event, and
 * reusing the links would put two rosters behind one URL.
 *
 * What Next's `revalidatePath` did on the way out is now the CALLER's second
 * half: the component that invoked this calls `router.invalidate()` on
 * success, so the list re-reads with the new event in it. The dynamic imports
 * keep this module loadable by the client component that calls it — the
 * compiler replaces the `.handler` body with an RPC stub in the browser
 * bundle, and everything server-only stays behind the `import()`.
 */
export const duplicateEventFn = createServerFn({ method: "POST" })
  .validator((data: { eventId: string }) => data)
  .handler(async ({ data }): Promise<DuplicateState> => {
    const [
      { and, eq },
      { uuidv7 },
      { db },
      { eventPolicies, events },
      { getViewerCopy },
      { getOrganizer },
      { nextWeekStart },
      { createOrganizerToken, createPublicToken },
      { eventIdSchema },
    ] = await Promise.all([
      import("drizzle-orm"),
      import("uuidv7"),
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/locale"),
      import("@/lib/organizer"),
      import("@/lib/recurrence"),
      import("@/lib/tokens"),
      import("@/lib/validation"),
    ]);

    const { copy } = await getViewerCopy();

    const organizer = await getOrganizer();
    if (!organizer) return { error: copy.errors.signInRequired };

    const eventId = eventIdSchema.safeParse(data.eventId);
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
        // The rule travels with the event: next week's game keeps this
        // week's policy, exactly like its cost.
        refundNoticeHours: source.refundNoticeHours,
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

    return { ok: true };
  });
