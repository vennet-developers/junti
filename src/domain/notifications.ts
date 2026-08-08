/*
  The one value import a module in here has. Every other domain module takes
  types only, and the exception is deliberate: `paths.ts` is the pure,
  dependency-free half of the URL helpers, and the alternative — writing `/e/…`
  out again in this file — would mean a route rename silently breaking exactly
  the links `deepLink` exists to keep correct.
*/
import type { Copy } from "@/config/copy";
import { managePath, participantPath } from "@/lib/paths";

/**
 * What can be notified, where it points, and how long ago it happened.
 *
 * Pure, and separate from the table for the same reason the analytics taxonomy
 * is: the set of things worth telling somebody about is a product decision that
 * has to be readable in one place, and every rule in here is the kind that is
 * easy to get subtly wrong and impossible to notice afterwards — a link that
 * goes to the wrong screen, a count that reads "0" because it was capped, a
 * relative time that says "in 3 seconds" because two clocks disagree.
 */

/**
 * The five v1 types, closed.
 *
 * Straight from the card, in the order they occur to somebody using the app:
 * an answer arrives, a receipt needs a look, money is settled, the plan
 * changes, the plan is off.
 *
 * **A type is not a template.** It says what happened; the sentence a reader
 * sees is built at read time from the reader's own copy block, because this app
 * is bilingual and a stored sentence would freeze somebody's notifications into
 * whichever language they were using the day each one was written.
 */
export const NOTIFICATION_TYPES = [
  "rsvp_received",
  "approval_pending",
  "payment_recorded",
  "event_updated",
  "event_postponed",
  "event_cancelled",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

/**
 * Which side of the event each type is addressed to.
 *
 * This is not documentation — it decides the link. An organizer opening "Ana
 * mandó un comprobante" needs the panel where receipts are judged; a
 * participant opening "se canceló" needs the event page, and must never be
 * handed a URL containing the organizer token. Writing the two down as data
 * means the link cannot disagree with the audience.
 */
export const RECIPIENT_ROLE: Record<NotificationType, "organizer" | "participant"> = {
  rsvp_received: "organizer",
  approval_pending: "organizer",
  payment_recorded: "participant",
  event_updated: "participant",
  event_postponed: "participant",
  event_cancelled: "participant",
};

export interface LinkContext {
  publicToken: string;
  /** Only ever read for an organizer-facing type. */
  organizerToken: string;
}

/**
 * Where tapping one goes — AC-3's "exact deep-linked context".
 *
 * **Derived, never stored.** A URL written into the row at creation time is a
 * copy of a routing decision, and copies rot: rename a segment and every
 * notification older than the deploy points at a 404. It would also duplicate
 * the organizer token into a second table, which is one more place a secret
 * exists for no benefit — the row already names the event, and the token is one
 * join away.
 *
 * The approvals queue is deliberately not the destination for a pending
 * receipt. It is the bulk screen, and bulk is the wrong verb here: somebody
 * arriving from a notification about ONE receipt wants to look at that image
 * and decide, which is the event panel.
 */
export function deepLink(type: NotificationType, context: LinkContext): string {
  return RECIPIENT_ROLE[type] === "organizer"
    ? managePath(context.publicToken, context.organizerToken)
    : participantPath(context.publicToken);
}

/**
 * The sentence for one notification, in the reader's language.
 *
 * Moved here from the lib so the push channel and the inbox read the SAME
 * sentence from the same function — and so it can be tested, which a module
 * that imports the database client at top level cannot be.
 *
 * Defensive about its own payload on purpose: these rows outlive deploys, and a
 * type whose payload shape changes later would otherwise render "undefined" at
 * somebody. Anything missing falls back to the event title alone, which is
 * still a true and openable thing to say.
 */
export function sentenceFor(
  type: NotificationType,
  payload: Record<string, unknown>,
  copy: Copy,
): string {
  const strings = copy.notifications.types;
  const name = typeof payload.name === "string" ? payload.name : "";

  switch (type) {
    case "rsvp_received": {
      const attendance = payload.attendance;
      const label =
        typeof attendance === "string" && attendance in copy.attendance
          ? copy.attendance[attendance as keyof typeof copy.attendance]
          : "";
      return name && label ? strings.rsvpReceived(name, label) : copy.notifications.title;
    }

    case "approval_pending":
      return name ? strings.approvalPending(name) : copy.notifications.title;

    case "payment_recorded":
      return payload.status === "waived" ? strings.paymentWaived : strings.paymentConfirmed;

    case "event_updated": {
      const changed = Array.isArray(payload.changed) ? (payload.changed as ChangedField[]) : [];
      const labels = changed
        .map((field) => copy.notifications.fields[field])
        .filter((label): label is string => Boolean(label));

      if (labels.length === 0) return copy.notifications.title;

      /*
        `Intl.ListFormat`, not `join(", ")`. Spanish and English disagree about
        the last separator ("la fecha y el lugar" against "the date and the
        place"), and one of the two languages is always wrong when a sentence
        is assembled with a comma.
      */
      return strings.eventUpdated(
        new Intl.ListFormat(copy.intlLocale, { style: "long", type: "conjunction" }).format(labels),
      );
    }

    case "event_postponed":
      return strings.eventPostponed;

    case "event_cancelled":
      return strings.eventCancelled;
  }
}

/**
 * Everything a push notification carries, derived — like the inbox — at the
 * moment of sending, never stored.
 *
 * The event title is the push TITLE and the sentence is the body: on a lock
 * screen the event is the context that makes the sentence readable, exactly
 * inverse to the drawer, where the sentence leads because the row shows the
 * title underneath. The URL is `deepLink`'s answer, so a tap lands where the
 * drawer's tap lands and the two channels cannot drift.
 */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export function pushPayload(
  type: NotificationType,
  payload: Record<string, unknown>,
  eventTitle: string,
  context: LinkContext,
  copy: Copy,
): PushPayload {
  return {
    title: eventTitle,
    body: sentenceFor(type, payload, copy),
    url: deepLink(type, context),
  };
}

/**
 * How many rows a page of the drawer holds — AC-7.
 *
 * Twenty is about two phone screens: enough that the first page is almost
 * always the whole answer, small enough that opening the drawer never pulls a
 * year of history over a mobile connection. Everything past it is fetched on
 * request, by cursor, never by offset — see `loadNotifications`.
 */
export const PAGE_SIZE = 20;

/**
 * Past this, the badge stops counting and starts saying "a lot".
 *
 * The number on a bell is a prompt, not a statistic. "47" and "9+" produce the
 * same action, and the second does not force the reader to work out whether 47
 * is worse than the 43 they saw yesterday.
 */
export const UNREAD_CAP = 9;

/** What the badge shows, or null when there is nothing to show. */
export function unreadBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > UNREAD_CAP ? `${UNREAD_CAP}+` : String(count);
}

/**
 * The fields whose change is worth telling participants about.
 *
 * Not every column: bumping `calendarSequence` is bookkeeping, and the group an
 * event is attached to changes who can be invited rather than anything a person
 * already coming would recognise. What is left is the things somebody would
 * want to know had moved.
 *
 * `rsvpDeadline` is on the list because it is the one field here that takes
 * something away: the person who was going to answer tomorrow needs to hear
 * that tomorrow is now too late. It moves on its own whenever the start time
 * does — the lead is applied to the new date — so a reschedule reports both,
 * which is correct rather than noisy: the date to answer by really did change.
 *
 * `costMode` and `costAmountMinor` collapse into one `cost`, because "the price
 * changed" is one fact to a reader even when it is two columns to the schema.
 */
const WATCHED_FIELDS = ["title", "startsAt", "location", "capacity", "rsvpDeadline"] as const;

export type ChangedField = (typeof WATCHED_FIELDS)[number] | "cost";

export interface EventSnapshot {
  title: string;
  startsAt: Date;
  location: string | null;
  capacity: number | null;
  rsvpDeadline: Date | null;
  costMode: string;
  costAmountMinor: number | null;
}

/**
 * What actually changed between two versions of an event.
 *
 * The reason this exists rather than "the event was updated": an organizer
 * fixing a typo in the notes and an organizer moving the match to Thursday are
 * the same UPDATE statement and completely different news. An empty result
 * means nobody is told anything, which is the case that matters most — it is
 * what stops a save-with-no-edits from pinging twenty people.
 *
 * Dates compare by instant. Two `Date` objects for the same moment are never
 * `===`, and comparing them by reference would report every save as a
 * reschedule.
 */
export function changedFields(before: EventSnapshot, after: EventSnapshot): ChangedField[] {
  const changed: ChangedField[] = [];

  for (const field of WATCHED_FIELDS) {
    const a = before[field];
    const b = after[field];
    const same = a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
    if (!same) changed.push(field);
  }

  if (before.costMode !== after.costMode || before.costAmountMinor !== after.costAmountMinor) {
    changed.push("cost");
  }

  return changed;
}

/**
 * How long ago, in the two numbers `Intl.RelativeTimeFormat` wants.
 *
 * Split from the formatting on purpose: the arithmetic is what can be wrong and
 * the wording is what has to be translated, and only one of those is worth a
 * test.
 *
 * **Never in the future.** A row written a second ago by a server whose clock
 * runs marginally ahead of the one doing the reading would otherwise render as
 * "in 1 second", which reads as a bug in a list of things that have already
 * happened. Anything not yet past is clamped to "now".
 */
export function relativeParts(
  atMs: number,
  nowMs: number,
): { value: number; unit: "second" | "minute" | "hour" | "day" } {
  const seconds = Math.max(0, Math.round((nowMs - atMs) / 1000));

  if (seconds < 60) return { value: -seconds, unit: "second" };

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { value: -minutes, unit: "minute" };

  const hours = Math.round(minutes / 60);
  if (hours < 24) return { value: -hours, unit: "hour" };

  return { value: -Math.round(hours / 24), unit: "day" };
}
