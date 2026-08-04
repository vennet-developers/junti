import "@/server/assert-server";

import { suppressedAmong } from "@/lib/consent";
import { sendMessage } from "@/lib/email/provider";
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
export async function notify(message: OutboundMessage): Promise<"sent" | "suppressed" | "failed"> {
  try {
    if ((await suppressedAmong([message.to])).size > 0) return "suppressed";

    const result = await sendMessage(message);
    return result.status === "sent"
      ? "sent"
      : result.status === "suppressed"
        ? "suppressed"
        : "failed";
  } catch {
    // A send that throws must never take the action that triggered it with it.
    return "failed";
  }
}
