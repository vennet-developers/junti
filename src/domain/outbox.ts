/**
 * When to retry, and what counts as the same message twice.
 *
 * Pure, because both answers are arithmetic and both are easy to get subtly
 * wrong in ways that only show up under load: a backoff that grows too slowly
 * hammers a provider that is already struggling, and a dedupe key that is too
 * specific lets the same person be told the same thing twice.
 */

/**
 * How many times a message is tried before it is left alone.
 *
 * Five attempts across the backoff below is a little under two hours. Past
 * that the failure is not transient — a dead address, a provider outage
 * measured in hours, a template that throws — and continuing to retry turns
 * one problem into a queue that never drains.
 */
export const MAX_ATTEMPTS = 5;

/**
 * Exponential, from one minute.
 *
 * 1, 2, 4, 8, 16 minutes. The first retry is deliberately not instant: almost
 * everything that fails on the first try is a provider blip or a rate limit,
 * and both are worse for being retried immediately.
 *
 * No jitter, and that is a real limitation rather than an oversight: jitter
 * matters when many senders retry in lockstep, and this app has one sender
 * processing a handful of messages. It becomes worth adding the day a batch
 * of two hundred invitations fails together.
 */
export function nextAttemptDelayMs(attempts: number): number {
  const minutes = 2 ** Math.max(0, attempts - 1);
  return minutes * 60_000;
}

/** When the next try should happen, given how many have already failed. */
export function nextAttemptAt(attempts: number, from: Date): Date {
  return new Date(from.getTime() + nextAttemptDelayMs(attempts));
}

/** Whether this message has anything left to try. */
export function canRetry(attempts: number): boolean {
  return attempts < MAX_ATTEMPTS;
}

/**
 * What makes two sends "the same message".
 *
 * The card asks for a key per `(template, recipient, event, trigger)`, and the
 * four parts are each load-bearing:
 *
 * - **template** — an invitation and a cancellation to the same person about
 *   the same event are different messages.
 * - **recipient** — obviously.
 * - **event** — the same person gets invited to many events.
 * - **trigger** — the part that is easy to leave out and the reason the other
 *   three are not enough. A *resend* is a deliberate second copy of the same
 *   invitation, and without something distinguishing it from the first, the
 *   dedupe would silently swallow exactly the action an organizer took on
 *   purpose.
 *
 * Lowercased, because an address that differs only in case is the same inbox
 * and would otherwise slip through as a second message.
 */
export function dedupeKey(parts: {
  template: string;
  recipient: string;
  eventId?: string | null;
  /** What caused this send. `resend:<n>` and `cancel` are the interesting ones. */
  trigger?: string | null;
}): string {
  return [
    parts.template,
    parts.recipient.trim().toLowerCase(),
    parts.eventId ?? "-",
    parts.trigger ?? "-",
  ].join("|");
}

export type OutboxStatus = "pending" | "sent" | "failed" | "suppressed";

/**
 * What a send attempt means for the row.
 *
 * `suppressed` is terminal and is not a failure: the recipient asked not to be
 * written to, so there is nothing to retry and nothing went wrong.
 */
export function nextStatus(
  result: "sent" | "suppressed" | "failed",
  attempts: number,
): OutboxStatus {
  if (result === "sent") return "sent";
  if (result === "suppressed") return "suppressed";
  return canRetry(attempts) ? "pending" : "failed";
}
