import { createServerFn } from "@tanstack/react-start";

import { ROUTES } from "@/config/routes";

export type CreateEventState = {
  errors: Record<string, string>;
  /**
   * Where to go after a successful create.
   *
   * Returned rather than thrown as a `redirect`. The thrown version worked for
   * as long as `/new` had no search params — once the wizard put `?step=` in
   * the URL, the router could no longer resolve the redirect against the
   * current location and it escaped to the error boundary as a bare
   * `Response`. The event was created and the organizer saw a crash, which is
   * the worst shape a bug can take: destructive-looking and completely
   * invisible in the logs.
   *
   * A returned string cannot do that. The caller navigates, and a navigation
   * that fails fails visibly.
   */
  redirectTo?: string;
};

/** Six new events per hour per IP is far past what a real organizer needs. */
const CREATE_LIMIT = 6;
const CREATE_WINDOW_MS = 60 * 60_000;

/**
 * Creates an event and sends the organizer to their control panel.
 *
 * The port of `src/app/new/actions.ts` — logic untouched, wrapper changed:
 * a server function taking the FormData the form already built, with every
 * server module behind a dynamic import (this file rides to the browser as
 * part of the route's client bundle; the handler body does not).
 */
export const createEventFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data: formData }): Promise<CreateEventState> => {
    const [
      { getRequest },
      { db },
      schema,
      { getViewerCopy },
      { clientIp, rateLimit },
      { formatEventDateTime },
      { getOrganizer },
      tokens,
      { participantPath },
      validation,
      { uuidv7 },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/locale"),
      import("@/lib/rate-limit"),
      import("@/lib/format"),
      import("@/lib/organizer"),
      import("@/lib/tokens"),
      import("@/lib/urls"),
      import("@/lib/validation"),
      import("uuidv7"),
    ]);
    const { field, fieldErrors, makeEventSchema, parsePoliciesField } = validation;
    const { enqueue, dispatchPending } = await import("@/lib/outbox");

    const ip = clientIp(getRequest().headers);
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
      minAttendees: field(formData, "minAttendees"),
      rsvpLead: field(formData, "rsvpLead"),
      notes: field(formData, "notes"),
      costMode: field(formData, "costMode"),
      costAmount: field(formData, "costAmount"),
      currency: field(formData, "currency") || "COP",
      refundNotice: field(formData, "refundNotice"),
      groupId: field(formData, "groupId"),
    });

    if (!parsed.success) {
      return { errors: fieldErrors(parsed.error) };
    }

    const policies = parsePoliciesField(field(formData, "policies"), copy);

    if (!policies.ok) {
      return { errors: { _form: policies.message } };
    }

    const input = parsed.data;
    const publicToken = tokens.createPublicToken();
    const organizerToken = tokens.createOrganizerToken();

    // Every event has an owner. The page will not render this form without a
    // session, but the check belongs here too — a server function is a public
    // endpoint, and "the page would not have shown it" authorizes nothing.
    const organizer = await getOrganizer();
    if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

    /*
      A group may only be attached by the person who owns it. Checked against
      the database rather than trusted from the select, because a group id is
      the key to inviting everybody inside it — pointing an event at somebody
      else's group would be a way to mail their people.
    */
    let groupId: string | null = null;
    if (input.groupId) {
      const { loadOwnedGroups } = await import("@/lib/groups");
      const owned = await loadOwnedGroups(organizer.id);
      if (!owned.some((group) => group.id === input.groupId)) {
        return { errors: { groupId: copy.errors.notFound } };
      }
      groupId = input.groupId;
    }

    const eventId = uuidv7();

    /**
     * The event and its policies land together or not at all. Without the
     * transaction, a failure between the two inserts leaves an event whose
     * organizer chose requirements that silently do not exist — and the
     * roster would then confirm everybody.
     */
    await db.transaction(async (tx) => {
      await tx.insert(schema.events).values({
        organizerId: organizer.id,
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
        minAttendees: input.minAttendees,
        rsvpDeadline: input.rsvpDeadline,
        notes: input.notes,
        costMode: input.costMode,
        costAmountMinor: input.costAmountMinor,
        currency: input.currency,
        refundNoticeHours: input.refundNotice,
        groupId,
      });

      /*
        The message goes in with the event, which is the gap this card names:
        writing after the transaction commits prevents "email sent, event
        rolled back" but not "event created, no email". Inside, the two either
        both exist or neither does.

        Dispatched below, after the commit — a provider must not be called
        from inside a transaction it could hold open.
      */
      if (organizer.email) {
        await enqueue(
          {
            message: {
              to: organizer.email,
              template: "event-created",
              locale: input.locale,
              values: {
                eventTitle: input.title,
                eventWhen: formatEventDateTime(input.startsAt, input.timeZone, copy.intlLocale),
                eventPath: participantPath(publicToken),
              },
            },
            eventId,
          },
          tx,
        );
      }

      if (policies.value.length > 0) {
        await tx.insert(schema.eventPolicies).values(
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

    // After the transaction and outside it, like the email below: an event
    // that exists is the fact, and neither a chart nor a provider undoes it.
    const { track } = await import("@/lib/analytics");
    track(
      "event_created",
      {
        event_id: eventId,
        has_cost: input.costMode !== "none",
        cost_mode: input.costMode,
        has_group: groupId !== null,
        policy_count: policies.value.length,
      },
      organizer.id,
    );

    /*
      Now that the event exists, try to send. The row is already written, so a
      failure here is a retry the sweep will pick up rather than a message
      nobody knows was lost.
    */
    await dispatchPending(5);

    /*
      Straight to the history, where the new event is the first card.
      `?created=1` because the confirmation has to survive the navigation.
    */
    return { errors: {}, redirectTo: `${ROUTES.myEvents}?created=1` };
  });
