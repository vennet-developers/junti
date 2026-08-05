import "@/server/assert-server";

import { buildIcs, ICS_FILENAME, type IcsEvent } from "@/domain/ics";
import type { EventRow } from "@/db/schema";
import type { OutboundAttachment } from "@/lib/email/port";
import { origin } from "@/lib/urls";
import { participantPath } from "@/lib/paths";

/**
 * An event row, as the calendar attachment that rides on a message.
 *
 * The bridge between the pure generator in `src/domain/ics.ts` and the things
 * only the server knows: the absolute origin, and the row itself.
 *
 * **A calendar file is an addition, never a requirement.** Everything here
 * returns `undefined` rather than throwing if it cannot produce one — an
 * invitation without an attachment is still an invitation, and a message that
 * failed to send because a calendar file could not be built would be a
 * spectacularly bad trade.
 */
export async function calendarAttachment(
  event: EventRow,
  method: "REQUEST" | "CANCEL" = "REQUEST",
): Promise<OutboundAttachment | undefined> {
  try {
    const base = await origin();

    const ics: IcsEvent = {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      location: event.location,
      url: `${base}${participantPath(event.publicToken)}`,
      notes: event.notes,
      sequence: event.calendarSequence,
      method,
      stamp: new Date(),
    };

    return {
      filename: ICS_FILENAME,
      content: buildIcs(ics),
      /*
        The `method` parameter on the content type is not decoration: it is how
        a mail client decides whether to offer "add to calendar" or to process
        the file as a cancellation. Gmail and Outlook both read it, and both
        treat a `text/calendar` with no method as a plain file to download.
      */
      contentType: `text/calendar; method=${method}; charset=utf-8`,
    };
  } catch {
    return undefined;
  }
}
