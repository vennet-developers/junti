import "@/server/assert-server";

import type { OutboundMessage } from "@/lib/email/port";

/**
 * Sending, with the suppression list in front of it.
 *
 * **Every send that is not the way in goes through here.** Auth links do not:
 * somebody who unsubscribed from invitations and then signs in has asked for
 * that link, and withholding it would lock them out of their own account using
 * a preference about marketing. Everything else — invitations, receipts,
 * confirmations — checks first.
 *
 * The check lives here rather than inside the port because the port's job is
 * delivery, and "should this person be written to at all" is a question about
 * consent, not transport. A WhatsApp adapter will need the same gate and a
 * different list.
 *
 * Failures are swallowed on purpose. These are all messages ABOUT something
 * that already happened — an event exists, an RSVP is recorded — and the thing
 * itself must not be undone because a provider had a bad minute. The result is
 * returned for a caller that wants to log it; nobody has to check it.
 */
export async function notify(
  message: OutboundMessage,
  /** For the dedupe key. See `src/domain/outbox.ts`. */
  context: { eventId?: string | null; trigger?: string | null } = {},
): Promise<"sent" | "suppressed" | "failed"> {
  try {
    const { enqueueAndSend } = await import("@/lib/outbox");

    /*
      Through the outbox, so every existing call site gets the record for free.
      The row is written before the send, which is what makes a message that
      never went out findable — this function still swallows the outcome, and
      that used to mean a failed send left no trace anywhere.

      A duplicate is reported as sent: the message exists and somebody already
      dealt with it, which is the answer the caller wants.
    */
    const status = await enqueueAndSend({
      message,
      eventId: context.eventId,
      trigger: context.trigger,
    });

    if (status === "sent" || status === "duplicate") return "sent";
    if (status === "suppressed") return "suppressed";
    return "failed";
  } catch {
    // A send that throws must never take the action that triggered it with it.
    return "failed";
  }
}
