import { createFileRoute } from "@tanstack/react-router";

/**
 * The event as a calendar file, downloadable from the page itself.
 *
 * **This exists to answer AC-1 of the Google Calendar card**, which gates that
 * whole feature on "ICS adoption data showing real demand" — and there was no
 * such data, and no way for there to be any. The calendar file only ever
 * existed as an email attachment, so the one number anybody could have quoted
 * was how many emails went out, which says nothing about whether a single
 * person ever put a Junti event in their calendar.
 *
 * It also fixes a gap that is worth fixing on its own terms. Most people arrive
 * from a WhatsApp link and never receive any email at all, so for the majority
 * of participants the calendar feature did not exist. A button on the page they
 * are already looking at is the whole of what most of them wanted from
 * "calendar integration".
 *
 * **A route rather than a client-side blob**, for three reasons that all point
 * the same way: the ICS builder is server code and shipping it to the browser
 * would drag the formatting rules into the client bundle; the download can be
 * counted truthfully on the server, where an extension cannot block it; and a
 * real URL is something a person can send to somebody else.
 *
 * **No session required**, matching the page it hangs off. The public token is
 * the access control, and this file carries strictly less than the page does —
 * the title, the time, the place and a link back, and no roster.
 */
export const Route = createFileRoute("/e/$public_token/calendar.ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        /*
          Server modules arrive by dynamic import because this FILE ships to
          the browser — a route is part of the client route tree even when all
          it defines is a server handler. The tripwire in
          `scripts/check-client-bundle.mjs` is what catches a top-level import
          here.
        */
        const [{ findEventByPublicToken }, { buildIcs, ICS_FILENAME }, { origin }, { track }] =
          await Promise.all([
            import("@/lib/roster"),
            import("@/domain/ics"),
            import("@/lib/urls"),
            import("@/lib/analytics"),
          ]);

        const event = await findEventByPublicToken(params.public_token);
        if (!event) return new Response("Not found", { status: 404 });

        const base = await origin();
        const { participantPath } = await import("@/lib/paths");

        /*
          CANCEL for an event that is off, REQUEST otherwise — the same rule the
          emails follow. Somebody who cancelled their plans and then opens the
          old link should not be handed a file that puts the event back.
        */
        const method = event.cancelledAt ? "CANCEL" : "REQUEST";

        const body = buildIcs({
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          location: event.location,
          url: `${base}${participantPath(event.publicToken)}`,
          notes: event.notes,
          sequence: event.calendarSequence,
          method,
          stamp: new Date(),
        });

        /*
          The number this route was built to produce. Server-side, so it counts
          what actually happened rather than what a browser was willing to
          report — and with no actor id, because this works without a session
          and inventing one would make the count wrong in the other direction.
        */
        track("calendar_added", { event_id: event.id, cancelled: method === "CANCEL" });

        return new Response(body, {
          headers: {
            "content-type": `text/calendar; method=${method}; charset=utf-8`,
            // `attachment` rather than `inline`: every desktop OS hands a
            // downloaded .ics to the calendar app, which is the point. Inline
            // would show the raw text in a browser tab on some platforms.
            "content-disposition": `attachment; filename="${ICS_FILENAME}"`,
            /*
              Never cached. The file carries SEQUENCE, and a stale copy is one
              that tells a calendar the event has not moved since the last time
              it heard — which is precisely how an edited event fails to update.
            */
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
