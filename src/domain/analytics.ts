/**
 * The event taxonomy, as types.
 *
 * `ANALYTICS.md` is the prose version and the reasoning; this is the part the
 * compiler enforces. The card's guidance says AC-1 is the expensive-to-change
 * criterion — renaming an event after data accumulates loses the history it
 * was collected for — so the names live in a closed union rather than being
 * passed as strings at each call site. A typo becomes a build error instead of
 * a second event nobody notices until a funnel is short by 12%.
 *
 * Pure on purpose: no database, no request, nothing to mock. What is worth
 * testing here is that the shapes cannot drift from the document.
 */

/** Every event this app may record. Adding one means adding it to ANALYTICS.md. */
export const ANALYTICS_EVENTS = [
  // Organizer funnel
  "landing_viewed",
  "create_started",
  "create_step_viewed",
  "create_step_completed",
  "create_abandoned",
  "event_created",
  "event_edited",
  "event_closed",
  "event_cancelled",

  // Participant funnel
  "invite_sent",
  "event_viewed",
  "rsvp_started",
  "rsvp_completed",
  "policy_submitted",
  "policy_reviewed",
  "payment_recorded",

  /*
    Calendar. One event, and it is a gate rather than a funnel step: the Google
    Calendar card refuses to start until "ICS adoption data shows real demand",
    and this is the only thing that can ever produce that number.
  */
  "calendar_added",
  "spot_held",
  "spot_claimed",
  "settlement_requested",
  "push_enabled",

  // Groups
  "group_created",
  "group_link_viewed",
  "group_answered",
  "group_left",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/**
 * Which layer is allowed to fire each event.
 *
 * AC-6, as data rather than as a convention. Money-related events are
 * server-only because a client can lie about a payment and an extension can
 * block the call — anything that would be read as revenue is recorded where
 * the write happens.
 *
 * The client entries are the ones that cannot be server-side: a view, an
 * abandonment, the moment somebody first touches a control. Nothing on the
 * server knows those happened.
 */
export const EVENT_SOURCE: Record<AnalyticsEvent, "server" | "client"> = {
  landing_viewed: "client",
  create_started: "client",
  create_step_viewed: "client",
  create_step_completed: "client",
  create_abandoned: "client",
  event_created: "server",
  event_edited: "server",
  event_closed: "server",
  event_cancelled: "server",

  invite_sent: "server",
  event_viewed: "client",
  rsvp_started: "client",
  rsvp_completed: "server",
  policy_submitted: "server",
  policy_reviewed: "server",
  calendar_added: "server",
  spot_held: "server",
  spot_claimed: "server",
  settlement_requested: "server",
  push_enabled: "server",
  payment_recorded: "server",

  group_created: "server",
  group_link_viewed: "client",
  group_answered: "server",
  group_left: "server",
};

/** The events a browser may report. Anything else arriving there is dropped. */
export const CLIENT_EVENTS = ANALYTICS_EVENTS.filter(
  (name) => EVENT_SOURCE[name] === "client",
);

export function isClientEvent(name: string): name is AnalyticsEvent {
  return (CLIENT_EVENTS as readonly string[]).includes(name);
}

/**
 * What a property value may be.
 *
 * Deliberately narrow. `props` is jsonb and could hold anything, and the one
 * rule that keeps this table from quietly becoming a second copy of the roster
 * is that it holds ids and enums — never a name, an address, a message body or
 * an amount. A type cannot tell a uuid from a display name, so this is only
 * half the guard; the other half is `stripUnsafeProps` below and the review
 * that reads a diff adding a property.
 */
/**
 * A list is allowed, and only a list of the same narrow thing.
 *
 * `event_edited` carries `changed: string[]` — the FIELD NAMES an organizer went
 * back to alter, which is the question that event exists to answer and cannot
 * be asked of a single value. The values themselves are never here.
 *
 * Every element goes through the same length check as a bare string below, so
 * the list cannot become the hiding place for the prose the scalar rule keeps
 * out.
 */
export type PropValue = string | number | boolean | null | string[];
export type AnalyticsProps = Record<string, PropValue>;

/**
 * Keys that must never appear in `props`, whatever a call site intends.
 *
 * A blocklist is the weaker kind of guard — it catches the mistake somebody
 * makes on purpose-ish, at 2am, copying a nearby object — and it is here
 * because the failure it prevents is silent and permanent. Nobody audits an
 * analytics table before exporting it.
 *
 * Money is on the list for a different reason than the rest: the ledger is
 * already exact, and a second weaker copy of an amount is a liability with no
 * upside.
 */
const FORBIDDEN_KEYS = [
  "email",
  "name",
  "display_name",
  "displayName",
  "phone",
  "whatsapp",
  "note",
  "message",
  "title",
  "amount",
  "amount_minor",
  "amountMinor",
  "token",
  "public_token",
  "organizer_token",
];

export interface StripResult {
  props: AnalyticsProps;
  /** What was removed, so a dev-mode warning can name it. */
  dropped: string[];
}

/**
 * Removes anything that must not be recorded, and says what it removed.
 *
 * Returns rather than throws: analytics must never be the reason a mutation
 * fails. A dropped property is a gap in a chart; a thrown error is a lost RSVP.
 */
export function stripUnsafeProps(props: AnalyticsProps): StripResult {
  const safe: AnalyticsProps = {};
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      dropped.push(key);
      continue;
    }

    // A string long enough to be prose is not an id or an enum. This catches
    // the free-text case the key blocklist cannot: `{ reason: "no me sirve
    // la foto que mandó Ana" }` has an innocent key.
    if (typeof value === "string" && value.length > 64) {
      dropped.push(key);
      continue;
    }

    // A list is held to the same rule, element by element. One long string in
    // it is enough to drop the whole property: a partially-sanitised list would
    // be a silently different answer to the question the event asks.
    if (Array.isArray(value) && value.some((item) => typeof item !== "string" || item.length > 64)) {
      dropped.push(key);
      continue;
    }

    safe[key] = value;
  }

  return { props: safe, dropped };
}
