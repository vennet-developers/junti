import "@/server/assert-server";

/**
 * What sending a message means here, independent of who sends it.
 *
 * This is the seam the whole feature is built around: call sites describe a
 * message, and which service carries it is a deployment decision made in
 * `provider.ts`. Swapping Resend for anyone else is adding a file next to
 * `resend.ts` and changing one environment variable — no call site moves.
 *
 * **Channel-agnostic on purpose.** WhatsApp is the channel this product
 * actually lives on, and it will need to send the same things. So a message is
 * a recipient, a template name and the values that fill it — not a subject line
 * and an HTML body, which are email's shape and would have to be unlearned to
 * reuse any of this. The email adapter is where a template becomes a subject
 * and a body; a WhatsApp adapter would render the same contract into whatever
 * that API wants.
 */

/**
 * The messages this app can send, by name.
 *
 * A closed union rather than free strings: a template that does not exist is a
 * build error rather than a delivery that silently never happens, and adding a
 * name here without writing its renderer does not compile.
 */
export type MessageTemplate =
  | "pending-approval"
  | "event-invitation"
  | "auth-link"
  | "event-created"
  | "rsvp-confirmed"
  | "event-cancelled"
  | "settlement-request";

export interface OutboundMessage {
  /** Where it goes. An email address today; a phone number for WhatsApp. */
  to: string;
  template: MessageTemplate;
  /**
   * Whatever that template interpolates.
   *
   * Strings, deliberately: these cross a process boundary the moment a send
   * moves to a queue, and a contract that only carries what survives JSON is
   * one that keeps working when it does. Each template narrows this to its own
   * shape where it renders.
   */
  values: Record<string, string>;
  /**
   * The reader's language, so the adapter renders in it.
   *
   * Carried on the message rather than read from a request: a message may be
   * sent from a background job that has no reader, and the recipient's language
   * is a fact about them, not about who triggered the send.
   */
  locale: string;
  /**
   * This message belongs to a test, not to somebody's real event.
   *
   * A flag about the message's ORIGIN, not about how to render it — which is
   * why it is a boolean and not a subject prefix. The port's whole contract is
   * a recipient, a template and values, precisely so a WhatsApp adapter can
   * reuse it without learning email's shape; deciding that "sandbox" means
   * `[sandbox] ` in front of a subject line is the email adapter's business,
   * and a WhatsApp adapter would express the same fact its own way.
   *
   * Defaulted centrally in `sendMessage` from the environment, so no call site
   * has to remember. Set it explicitly only where the environment lies — see
   * the send-email hook, which always runs in production even when the person
   * signing in is on their laptop.
   */
  sandbox?: boolean;
  /**
   * Files that ride along, if the channel has such a thing.
   *
   * Optional, and the port stays honest about being channel-agnostic: an
   * adapter that cannot carry attachments — WhatsApp, one day — drops them
   * rather than failing, because the message is still worth sending. A
   * calendar file is an addition to an invitation, not the invitation.
   */
  attachments?: OutboundAttachment[];
}

export interface OutboundAttachment {
  filename: string;
  /** UTF-8 text. Every attachment this app sends is a text format. */
  content: string;
  /** e.g. `text/calendar; method=REQUEST; charset=utf-8`. */
  contentType: string;
}

/**
 * What a send can end in.
 *
 * `suppressed` is not an error. A recipient on the suppression list has already
 * told us to stop — by bouncing, or by complaining — and reaching them was
 * never going to happen. The caller usually wants to carry on rather than
 * retry, which is a different decision from a provider being down, so the two
 * cannot share a shape.
 */
export type SendResult =
  { status: "sent"; id: string } | { status: "suppressed" } | { status: "failed"; reason: string };

/**
 * The port. One method, deliberately.
 *
 * Batch sending, scheduling and templates-as-data are all things providers
 * offer and all things that would leak a provider's shape into this interface.
 * They can arrive as new methods when something actually needs them.
 */
export interface EmailPort {
  /** For logs and for the "which provider is this" question in an incident. */
  readonly name: string;
  send(message: OutboundMessage): Promise<SendResult>;
}
