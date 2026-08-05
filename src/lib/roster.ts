import "@/server/assert-server";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  eventPolicies,
  events,
  eventTypes,
  invitations,
  participants,
  payments,
  policyDefinitions,
  policyEvidence,
  policySubmissions,
  userProfiles,
} from "@/db/schema";
import type { CostMode, EventRow, ParticipantRow, PaymentRow } from "@/db/schema";

import { attendingCountSql, firstAttendeesSql } from "./roster-select";
import {
  partitionByCompliance,
  pendingReviewCount,
  resolveCompliance,
  type ParticipantCompliance,
  type Policy,
  type PolicySubmission,
} from "@/domain/policies";
import { computeSplit, type Share, type SplitParticipant } from "@/domain/split";
import type { Attendance } from "@/domain/types";
import { openSlots, promotableCount, waitlistOrder } from "@/domain/waitlist";

import type { Locale } from "@/config/copy";

import { hasEvidence } from "./evidence-store";
import { pickLabel, pickOptionalLabel } from "./labels";

/**
 * Reads an event and everything hanging off it, then runs the domain rules over
 * the result.
 *
 * This is the only module that maps database rows onto domain shapes, which is
 * what keeps `src/domain` free of ORM imports.
 *
 * Nothing here ever returns `organizerToken` in a shape destined for a
 * participant route — see `toParticipantView`.
 */

export interface RosterMember {
  id: string;
  displayName: string;
  attendance: Attendance;
  joinedAt: Date;
  share: Share;
  /** Set when this RSVP came from a signed-in account. */
  userId: string | null;
  avatarUrl: string | null;
}

export interface EventView {
  id: string;
  publicToken: string;
  title: string;
  /** The catalogue row this event points at. */
  eventTypeId: string;
  /** Stable key, for the rare code that must special-case a type. */
  eventTypeSlug: string;
  /** Already resolved into the reader's language. */
  eventTypeLabel: string;
  startsAt: Date;
  timeZone: string;
  locale: string;
  location: string | null;
  capacity: number | null;
  notes: string | null;
  costMode: EventRow["costMode"];
  costAmountMinor: number | null;
  currency: string;
  /** The group this event invites from, or null for a one-off. */
  groupId: string | null;
  closedAt: Date | null;
  isClosed: boolean;
  /** Called off. A different fact from closed — see the schema. */
  isCancelled: boolean;
  hasCost: boolean;
}

export interface RosterView {
  event: EventView;
  members: RosterMember[];
  attending: RosterMember[];
  notAttending: RosterMember[];
  maybe: RosterMember[];
  waitlisted: RosterMember[];
  /**
   * `attending`, split by whether the event's policies are met.
   *
   * Both halves are still attending: they hold their spot and owe their share
   * either way. The split governs how the roster reads, not who is on it.
   */
  confirmed: RosterMember[];
  pendingPolicy: RosterMember[];
  policies: Policy[];
  compliance: Map<string, ParticipantCompliance>;
  /** Submissions waiting on the organizer, for the badge on the review section. */
  pendingReview: number;
  collectedMinor: number;
  outstandingMinor: number;
  waivedMinor: number;
  totalComputedMinor: number;
  discrepancies: ReturnType<typeof computeSplit>["discrepancies"];
  /** Null when capacity is unlimited. */
  openSlots: number | null;
  promotable: number;
}

type JoinedRow = {
  participant: ParticipantRow;
  payment: PaymentRow | null;
};

function toEventView(row: EventRow, type: { slug: string; label: string }): EventView {
  return {
    id: row.id,
    publicToken: row.publicToken,
    title: row.title,
    eventTypeId: row.eventTypeId,
    eventTypeSlug: type.slug,
    eventTypeLabel: type.label,
    startsAt: row.startsAt,
    timeZone: row.timeZone,
    locale: row.locale,
    location: row.location,
    capacity: row.capacity,
    notes: row.notes,
    costMode: row.costMode,
    costAmountMinor: row.costAmountMinor,
    currency: row.currency,
    groupId: row.groupId,
    closedAt: row.closedAt,
    isClosed: row.closedAt !== null,
    isCancelled: row.cancelledAt !== null,
    hasCost: row.costMode !== "none",
  };
}

function toSplitParticipant(row: JoinedRow): SplitParticipant {
  return {
    id: row.participant.id,
    joinedAt: row.participant.createdAt,
    attendance: row.participant.attendance,
    payment: row.payment
      ? { status: row.payment.status, amountMinor: row.payment.amountMinor }
      : null,
  };
}

/** Loads the event by participant token, or null if the token matches nothing. */
export async function findEventByPublicToken(publicToken: string): Promise<EventRow | null> {
  const [row] = await db.select().from(events).where(eq(events.publicToken, publicToken)).limit(1);
  return row ?? null;
}

/**
 * Loads the event only when BOTH tokens match the same row.
 *
 * Checking the organizer token alone would be enough, but requiring the pair
 * means a mistyped or mismatched URL fails closed rather than granting admin on
 * some other event.
 */
export async function findEventByOrganizerToken(
  publicToken: string,
  organizerToken: string,
): Promise<EventRow | null> {
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.publicToken, publicToken), eq(events.organizerToken, organizerToken)))
    .limit(1);

  return row ?? null;
}

/**
 * Authorizes an organizer action by EITHER route.
 *
 * Two ways to reach an event's controls, deliberately:
 *
 * 1. **The organizer token in the URL.** How you hand an event to a friend so
 *    they can run the day while you are not looking at your phone.
 * 2. **Ownership.** The account that created it, which is what lets the history
 *    page link straight into managing without carrying the token around.
 *
 * **A session is required either way**, and that is the change. The token used
 * to be an identity all by itself: holding the link WAS being the organizer, so
 * losing it lost the event and finding it gained one. Now it delegates — it says
 * which event you may help run, and the session says who is helping. What the
 * delegate cannot do is edit the event itself; see `canEdit` on the manage page.
 *
 * Both routes are checked server-side against the database, never against
 * anything the client asserts. Returns null when neither holds.
 */
export async function authorizeOrganizer(
  publicToken: string,
  organizerToken: string,
  currentOrganizerId: string,
): Promise<EventRow | null> {
  const byToken = await findEventByOrganizerToken(publicToken, organizerToken);
  if (byToken) return byToken;

  const [owned] = await db
    .select()
    .from(events)
    .where(and(eq(events.publicToken, publicToken), eq(events.organizerId, currentOrganizerId)))
    .limit(1);

  return owned ?? null;
}

async function loadJoinedRows(eventId: string): Promise<JoinedRow[]> {
  const rows = await db
    .select({ participant: participants, payment: payments })
    .from(participants)
    .leftJoin(payments, eq(payments.participantId, participants.id))
    .where(eq(participants.eventId, eventId))
    .orderBy(asc(participants.createdAt), asc(participants.id));

  return rows;
}

/**
 * The event's policies, in display order, resolved for reading.
 *
 * Each row carries only what is specific to this event; the wording and the
 * behaviour come from the catalogue. The override wins when the organizer set
 * one, and NULL means follow the definition — which is what makes fixing a
 * typo in the catalogue fix it everywhere that never overrode it.
 *
 * Deliberately does NOT filter on `policy_definitions.is_active`. Retiring a
 * policy takes it out of the picker for new events; it must not blank out the
 * requirement on events that already have it.
 */
export async function loadEventPolicies(eventId: string, locale: Locale): Promise<Policy[]> {
  const rows = await db
    .select({
      id: eventPolicies.id,
      definitionId: policyDefinitions.id,
      handler: policyDefinitions.handler,
      slug: policyDefinitions.slug,
      override: eventPolicies.label,
      overrideDescription: eventPolicies.description,
      labels: policyDefinitions.labels,
      descriptions: policyDefinitions.descriptions,
      position: eventPolicies.position,
    })
    .from(eventPolicies)
    .innerJoin(policyDefinitions, eq(policyDefinitions.id, eventPolicies.policyDefinitionId))
    .where(eq(eventPolicies.eventId, eventId))
    .orderBy(asc(eventPolicies.position), asc(eventPolicies.id));

  return rows.map((row) => ({
    id: row.id,
    definitionId: row.definitionId,
    handler: row.handler,
    label: row.override ?? pickLabel(row.labels, locale, row.slug),
    description: row.overrideDescription ?? pickOptionalLabel(row.descriptions, locale),
    labelOverride: row.override,
    descriptionOverride: row.overrideDescription,
    position: row.position,
  }));
}

/**
 * Every submission on the event, as the domain layer wants them.
 *
 * Selects explicit columns rather than the whole row — not for speed here, but
 * because `select().from()` habits are how the image would eventually get
 * dragged in. The image lives in its own table precisely so it cannot be, and
 * this keeps the habit consistent.
 */
export async function loadPolicySubmissions(eventId: string): Promise<PolicySubmission[]> {
  const rows = await db
    .select({
      policyId: policySubmissions.policyId,
      participantId: policySubmissions.participantId,
      status: policySubmissions.status,
    })
    .from(policySubmissions)
    .innerJoin(eventPolicies, eq(eventPolicies.id, policySubmissions.policyId))
    .innerJoin(policyDefinitions, eq(policyDefinitions.id, eventPolicies.policyDefinitionId))
    .where(eq(eventPolicies.eventId, eventId));

  return rows;
}

/**
 * Builds the full view of an event: roster, money, capacity, policies.
 *
 * Takes the reader's language because catalogue labels are stored per locale
 * and the roster renders them. That is presentation reaching into the loader,
 * and the alternative — returning raw translation bags and resolving them at
 * every call site — spreads the same concern over more places.
 */
export async function loadRoster(eventRow: EventRow, locale: Locale): Promise<RosterView> {
  const [rows, policies, submissions, type] = await Promise.all([
    loadJoinedRows(eventRow.id),
    loadEventPolicies(eventRow.id, locale),
    loadPolicySubmissions(eventRow.id),
    loadEventType(eventRow.eventTypeId, locale),
  ]);

  const split = computeSplit({
    costMode: eventRow.costMode,
    costAmountMinor: eventRow.costAmountMinor,
    participants: rows.map(toSplitParticipant),
  });

  const sharesById = new Map(split.shares.map((share) => [share.participantId, share]));

  const members: RosterMember[] = rows.map((row) => ({
    id: row.participant.id,
    displayName: row.participant.displayName,
    attendance: row.participant.attendance,
    joinedAt: row.participant.createdAt,
    userId: row.participant.userId,
    avatarUrl: row.participant.avatarUrl,
    // Every participant gets a share entry from computeSplit, so this is always
    // present; the fallback keeps the code free of a non-null assertion.
    share: sharesById.get(row.participant.id) ?? {
      participantId: row.participant.id,
      computedAmountMinor: 0,
      effectiveAmountMinor: 0,
      status: "pending" as const,
      owes: false,
      discrepancyMinor: 0,
    },
  }));

  const capacityInput = members.map((m) => ({
    id: m.id,
    joinedAt: m.joinedAt,
    attendance: m.attendance,
  }));

  const waitlistIds = new Set(waitlistOrder(capacityInput).map((p) => p.id));

  const attending = members.filter((m) => m.attendance === "in");

  // Compliance is resolved only for people who said they are coming — nobody
  // else is subject to the policies, and computing it for them would put an
  // "out" answer into the pending-policy bucket.
  const compliance = resolveCompliance(
    attending.map((m) => m.id),
    policies,
    submissions,
  );

  const { confirmed, pending } = partitionByCompliance(attending, compliance);

  return {
    event: toEventView(eventRow, type),
    members,
    attending,
    confirmed,
    pendingPolicy: pending,
    policies,
    compliance,
    pendingReview: pendingReviewCount(submissions),
    notAttending: members.filter((m) => m.attendance === "out"),
    maybe: members.filter((m) => m.attendance === "maybe"),
    // Ordered by the domain's waitlist rule, not by array position.
    waitlisted: waitlistOrder(capacityInput)
      .map((p) => members.find((m) => m.id === p.id))
      .filter((m): m is RosterMember => m !== undefined && waitlistIds.has(m.id)),
    collectedMinor: split.collectedMinor,
    outstandingMinor: split.outstandingMinor,
    waivedMinor: split.waivedMinor,
    totalComputedMinor: split.totalComputedMinor,
    discrepancies: split.discrepancies,
    openSlots: openSlots(eventRow.capacity, capacityInput),
    promotable: promotableCount(eventRow.capacity, capacityInput),
  };
}

/**
 * An organizer's events, newest first, with the attending count.
 *
 * Ordered by `created_at` descending — when they set it up, not when it
 * happens — which is what "history" means here and what
 * `events_organizer_created_idx` is built for.
 *
 * Returns the organizer token: this is only ever called for the viewer's OWN
 * events, and the history needs to link straight into managing them.
 */
export interface OrganizerEventSummary {
  id: string;
  title: string;
  eventTypeId: string;
  startsAt: Date;
  /** Each event renders in its own zone — a history can span countries. */
  timeZone: string;
  createdAt: Date;
  location: string | null;
  isClosed: boolean;
  /**
   * Whether the event has already started, decided by the DATABASE clock.
   *
   * Not computed in the page and not in the browser: doing it in a component
   * makes "now" a render-time value, so a client re-render can silently
   * disagree with the server's first paint for anything starting near this
   * instant. One clock, evaluated once, travelling with the row.
   */
  isPast: boolean;
  publicToken: string;
  organizerToken: string;
  /** How the event is charged, if at all — 'none' when it is free. */
  costMode: CostMode;
  /** Minor units of `currency`. Null when `costMode` is 'none'. */
  costAmountMinor: number | null;
  currency: string;
  attendingCount: number;
  /**
   * The first few people who said they are coming, oldest first, for the
   * avatar stack on the history card. Capped in SQL rather than trimmed here:
   * a card shows three faces and a "+N", so fetching every name of every event
   * to throw them away would grow with the roster for no visible gain.
   */
  firstAttendees: string[];
}

/**
 * How one person relates to one event.
 *
 * `invited` is the only one that is not a decision: somebody was asked and has
 * not answered. It is the state the agenda pins to the top, because it is the
 * only one on the page asking for anything.
 */
export type MyEventRole = "organizer" | Attendance | "invited";

/** Everything a card needs, regardless of how you are connected to the event. */
type MyEventCore = Omit<OrganizerEventSummary, "organizerToken" | "createdAt">;

/**
 * An event on somebody's agenda, discriminated by their role in it.
 *
 * **The union is the safety property, and it is why this is not one type with a
 * nullable token.** `organizer_token` is full control of an event; the manage
 * screen's own doc says it must never reach a participant route. A single shape
 * carrying `organizerToken: string | null` would compile perfectly while a card
 * rendered somebody else's manage link, and the mistake would look like a
 * missing null check rather than a leak. Here the field is ABSENT from the
 * variants where it would be a leak, so reading it without first narrowing to
 * `role === "organizer"` does not compile.
 *
 * Absent, specifically — not `organizerToken?: never`. That was the first
 * attempt and it defeats the whole point: an optional `never` still declares the
 * property, so `event.organizerToken` type-checks everywhere and merely comes
 * back `undefined`. A compile check confirms the difference; the version below
 * is the one that actually errors.
 */
export type MyEvent =
  | (MyEventCore & { role: "organizer"; organizerToken: string })
  | (MyEventCore & { role: Exclude<MyEventRole, "organizer"> });

/** The columns every one of the three queries below selects. */
const myEventColumns = {
  id: events.id,
  title: events.title,
  eventTypeId: events.eventTypeId,
  startsAt: events.startsAt,
  timeZone: events.timeZone,
  location: events.location,
  closedAt: events.closedAt,
  isPast: sql<boolean>`${events.startsAt} < now()`,
  publicToken: events.publicToken,
  costMode: events.costMode,
  costAmountMinor: events.costAmountMinor,
  currency: events.currency,
  attendingCount: attendingCountSql,
  firstAttendees: firstAttendeesSql,
} as const;

type MyEventRow = { closedAt: Date | null } & Omit<MyEventCore, "isClosed">;

function toCore(row: MyEventRow): MyEventCore {
  const { closedAt, ...rest } = row;
  return { ...rest, isClosed: closedAt !== null };
}

/**
 * Everything on one person's plate: what they run, what they answered, and what
 * they were asked and have not.
 *
 * Three queries rather than a UNION, because the three differ in what they join
 * and one of them selects a column the others must not. Merging in code also
 * makes the precedence explicit: **organizing wins**. An organizer who also
 * RSVP'd to their own event appears once, as the organizer, because that is the
 * relationship that decides what the card can do.
 *
 * Sorted the way an agenda reads rather than the way a history does: what is
 * coming, soonest first; what is done, most recent first. The old ordering was
 * by creation date, which answered "what did I make lately" — a different
 * question, and not the one somebody opens this page with.
 */
export async function loadMyEvents(userId: string): Promise<MyEvent[]> {
  const [organized, answered, invited] = await Promise.all([
    db
      .select({ ...myEventColumns, organizerToken: events.organizerToken })
      .from(events)
      .where(eq(events.organizerId, userId)),

    db
      .select({ ...myEventColumns, attendance: participants.attendance })
      .from(participants)
      .innerJoin(events, eq(events.id, participants.eventId))
      .where(eq(participants.userId, userId)),

    // Asked and unanswered. `participant_id` is null exactly until they RSVP,
    // so an accepted invitation drops out of here and reappears above with
    // whatever they actually said.
    db
      .select(myEventColumns)
      .from(invitations)
      .innerJoin(events, eq(events.id, invitations.eventId))
      .where(and(eq(invitations.userId, userId), isNull(invitations.participantId))),
  ]);

  const byId = new Map<string, MyEvent>();

  // Weakest claim first, strongest last: each pass overwrites the one before,
  // which is how "organizing wins" is enforced without a precedence table.
  for (const row of invited) {
    byId.set(row.id, { ...toCore(row), role: "invited" });
  }

  for (const row of answered) {
    const { attendance, ...rest } = row;
    byId.set(row.id, { ...toCore(rest), role: attendance });
  }

  for (const row of organized) {
    const { organizerToken, ...rest } = row;
    byId.set(row.id, { ...toCore(rest), role: "organizer", organizerToken });
  }

  return [...byId.values()].sort((a, b) => {
    if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
    const diff = a.startsAt.getTime() - b.startsAt.getTime();
    return a.isPast ? -diff : diff;
  });
}

export async function loadOrganizerEvents(organizerId: string): Promise<OrganizerEventSummary[]> {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      eventTypeId: events.eventTypeId,
      startsAt: events.startsAt,
      timeZone: events.timeZone,
      createdAt: events.createdAt,
      location: events.location,
      closedAt: events.closedAt,
      isPast: sql<boolean>`${events.startsAt} < now()`,
      publicToken: events.publicToken,
      organizerToken: events.organizerToken,
      costMode: events.costMode,
      costAmountMinor: events.costAmountMinor,
      currency: events.currency,
      // Both live in roster-select.ts, which documents why they are written
      // with literal names and which a test renders to SQL to keep them honest.
      attendingCount: attendingCountSql,
      firstAttendees: firstAttendeesSql,
    })
    .from(events)
    .where(eq(events.organizerId, organizerId))
    .orderBy(desc(events.createdAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    eventTypeId: row.eventTypeId,
    startsAt: row.startsAt,
    timeZone: row.timeZone,
    createdAt: row.createdAt,
    location: row.location,
    isClosed: row.closedAt !== null,
    isPast: row.isPast,
    publicToken: row.publicToken,
    organizerToken: row.organizerToken,
    costMode: row.costMode,
    costAmountMinor: row.costAmountMinor,
    currency: row.currency,
    attendingCount: row.attendingCount,
    firstAttendees: row.firstAttendees ?? [],
  }));
}

/** The raw participant + payment rows, for actions that need to write. */
export async function loadParticipantRows(eventId: string): Promise<JoinedRow[]> {
  return loadJoinedRows(eventId);
}

// ── Invitations ──────────────────────────────────────────────────────────────

export interface InvitationView {
  id: string;
  /** The account invited. Groups made this an id rather than an address. */
  userId: string;
  /** What to call them: their RSVP name if they answered, else their profile's. */
  displayName: string;
  /** They signed in and answered. What they answered is the roster's business. */
  answered: boolean;
  /** The name they answered under, when they have. */
  participantName: string | null;
  sentAt: Date;
}

/**
 * Everyone who was asked to this event, answered or not.
 *
 * **Every caller must be behind organizer authorization.** This is the one read
 * in this module that returns contact addresses, and the participant page has no
 * business calling it — which is why it is not folded into `loadRoster`, whose
 * result is rendered for anyone holding the public link.
 *
 * Unanswered first, because that is the list the organizer can still act on;
 * within each group, most recently sent first.
 */
export async function loadInvitations(eventId: string): Promise<InvitationView[]> {
  const rows = await db
    .select({
      id: invitations.id,
      userId: invitations.userId,
      invitedName: userProfiles.fullName,
      participantId: invitations.participantId,
      participantName: participants.displayName,
      sentAt: invitations.sentAt,
    })
    .from(invitations)
    .leftJoin(participants, eq(participants.id, invitations.participantId))
    .leftJoin(userProfiles, eq(userProfiles.userId, invitations.userId))
    .where(eq(invitations.eventId, eventId))
    .orderBy(asc(sql`(${invitations.participantId} is not null)`), desc(invitations.sentAt));

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    /*
      A name, where an address used to be. The organizer's question is "did I
      already ask Caro", and a name answers it — an address only ever answered
      it by accident, while also putting somebody's contact details on a
      screen that had no need for them.
    */
    displayName: row.participantName ?? row.invitedName ?? "—",
    answered: row.participantId !== null,
    participantName: row.participantName,
    sentAt: row.sentAt,
  }));
}

/**
 * Ties an invitation to the RSVP that answered it.
 *
 * Called on every join, matching the signed-in account itself. Once groups
 * made an invitation name a user id rather than an address, this stopped being
 * a lookup that could be fooled: there is no string to spoof, only the session
 * the request already authenticated as.
 *
 * Silent when there is no invitation. Most people arrive from a forwarded link
 * having never been invited by name, and that is the normal case, not a miss.
 */
export async function linkInvitationToParticipant(
  eventId: string,
  userId: string | null,
  participantId: string,
): Promise<void> {
  if (!userId) return;

  await db
    .update(invitations)
    .set({ participantId })
    .where(and(eq(invitations.eventId, eventId), eq(invitations.userId, userId)));
}

/**
 * WhatsApp numbers for the people on this event, keyed by participant id.
 *
 * **Every caller must be behind organizer authorization**, exactly like
 * `loadInvitations`. This is deliberately NOT folded into `loadRoster`: that
 * result renders for anyone holding the public link, and a phone number reaching
 * it would publish the group's contact details to the group's whole WhatsApp
 * chat and everyone they forwarded the link to.
 *
 * Returns a Map rather than widening `RosterMember`, so a phone cannot ride
 * along into a component that was only ever given a roster. The organizer page
 * has to ask for this on purpose.
 */
export async function loadParticipantContacts(eventId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ participantId: participants.id, phone: userProfiles.phone })
    .from(participants)
    .innerJoin(userProfiles, eq(userProfiles.userId, participants.userId))
    .where(eq(participants.eventId, eventId));

  return new Map(
    rows
      .filter((row): row is { participantId: string; phone: string } => Boolean(row.phone))
      .map((row) => [row.participantId, row.phone]),
  );
}

// ── Policy submissions ───────────────────────────────────────────────────────

interface SubmissionRow {
  id: string;
  policyId: string;
  policyOverride: string | null;
  policySlug: string;
  policyLabels: Record<string, string>;
  policyHandler: string;
  participantId: string;
  participantName: string;
  status: PolicySubmission["status"];
  note: string | null;
  reviewNote: string | null;
  createdAt: Date;
}

/** The event's override wins; otherwise the catalogue, in the reader's language. */
function toSubmissionDetail(
  row: SubmissionRow,
  locale: Locale,
): Omit<SubmissionDetail, "hasEvidence"> {
  return {
    id: row.id,
    policyId: row.policyId,
    policyLabel: row.policyOverride ?? pickLabel(row.policyLabels, locale, row.policySlug),
    policyHandler: row.policyHandler,
    participantId: row.participantId,
    participantName: row.participantName,
    status: row.status,
    note: row.note,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
  };
}

export interface SubmissionDetail {
  id: string;
  policyId: string;
  policyLabel: string;
  policyHandler: string;
  participantId: string;
  participantName: string;
  status: PolicySubmission["status"];
  note: string | null;
  reviewNote: string | null;
  createdAt: Date;
  hasEvidence: boolean;
}

/**
 * A submission, but only if it belongs to this event.
 *
 * The event id is part of the query rather than checked afterwards, which is
 * what stops a valid organizer token for event A from being used to read a
 * submission on event B by id. Everything that serves or judges evidence goes
 * through here.
 */
export async function findSubmissionInEvent(
  eventId: string,
  submissionId: string,
  locale: Locale,
): Promise<SubmissionDetail | null> {
  const [row] = await db
    .select({
      id: policySubmissions.id,
      policyId: policySubmissions.policyId,
      policyOverride: eventPolicies.label,
      policySlug: policyDefinitions.slug,
      policyLabels: policyDefinitions.labels,
      policyHandler: policyDefinitions.handler,
      participantId: policySubmissions.participantId,
      participantName: participants.displayName,
      status: policySubmissions.status,
      note: policySubmissions.note,
      reviewNote: policySubmissions.reviewNote,
      createdAt: policySubmissions.createdAt,
    })
    .from(policySubmissions)
    .innerJoin(eventPolicies, eq(eventPolicies.id, policySubmissions.policyId))
    .innerJoin(policyDefinitions, eq(policyDefinitions.id, eventPolicies.policyDefinitionId))
    .innerJoin(participants, eq(participants.id, policySubmissions.participantId))
    .where(and(eq(policySubmissions.id, submissionId), eq(eventPolicies.eventId, eventId)))
    .limit(1);

  if (!row) return null;

  return { ...toSubmissionDetail(row, locale), hasEvidence: await hasEvidence(row.id) };
}

/**
 * What the organizer has to look at, oldest first — whoever has been waiting
 * longest goes to the top.
 *
 * Acknowledgements never appear: they are approved on submission, so there is
 * nothing to decide.
 */
export async function loadReviewQueue(
  eventId: string,
  locale: Locale,
): Promise<SubmissionDetail[]> {
  const rows = await db
    .select({
      id: policySubmissions.id,
      policyId: policySubmissions.policyId,
      policyOverride: eventPolicies.label,
      policySlug: policyDefinitions.slug,
      policyLabels: policyDefinitions.labels,
      policyHandler: policyDefinitions.handler,
      participantId: policySubmissions.participantId,
      participantName: participants.displayName,
      status: policySubmissions.status,
      note: policySubmissions.note,
      reviewNote: policySubmissions.reviewNote,
      createdAt: policySubmissions.createdAt,
    })
    .from(policySubmissions)
    .innerJoin(eventPolicies, eq(eventPolicies.id, policySubmissions.policyId))
    .innerJoin(policyDefinitions, eq(policyDefinitions.id, eventPolicies.policyDefinitionId))
    .innerJoin(participants, eq(participants.id, policySubmissions.participantId))
    .where(and(eq(eventPolicies.eventId, eventId), eq(policySubmissions.status, "submitted")))
    .orderBy(asc(policySubmissions.createdAt));

  if (rows.length === 0) return [];

  // One query for all of them rather than one per row, and still without
  // reading a single image byte.
  const withImages = new Set(
    (
      await db
        .select({ submissionId: policyEvidence.submissionId })
        .from(policyEvidence)
        .where(
          inArray(
            policyEvidence.submissionId,
            rows.map((row) => row.id),
          ),
        )
    ).map((row) => row.submissionId),
  );

  return rows.map((row) => ({
    ...toSubmissionDetail(row, locale),
    hasEvidence: withImages.has(row.id),
  }));
}

/** One participant's submissions, for the "what is left" panel on their page. */
export async function loadParticipantSubmissions(
  participantId: string,
  locale: Locale,
): Promise<SubmissionDetail[]> {
  const rows = await db
    .select({
      id: policySubmissions.id,
      policyId: policySubmissions.policyId,
      policyOverride: eventPolicies.label,
      policySlug: policyDefinitions.slug,
      policyLabels: policyDefinitions.labels,
      policyHandler: policyDefinitions.handler,
      participantId: policySubmissions.participantId,
      participantName: participants.displayName,
      status: policySubmissions.status,
      note: policySubmissions.note,
      reviewNote: policySubmissions.reviewNote,
      createdAt: policySubmissions.createdAt,
    })
    .from(policySubmissions)
    .innerJoin(eventPolicies, eq(eventPolicies.id, policySubmissions.policyId))
    .innerJoin(policyDefinitions, eq(policyDefinitions.id, eventPolicies.policyDefinitionId))
    .innerJoin(participants, eq(participants.id, policySubmissions.participantId))
    .where(eq(policySubmissions.participantId, participantId))
    .orderBy(asc(eventPolicies.position));

  return rows.map((row) => ({ ...toSubmissionDetail(row, locale), hasEvidence: false }));
}

/**
 * One catalogue row, resolved.
 *
 * Falls back rather than throwing when the row is missing: `restrict` on the
 * foreign key means it cannot happen through the app, and an event that fails
 * to render because its type was deleted out of the database by hand would be
 * a worse outcome than one labelled with its own id.
 */
async function loadEventType(
  eventTypeId: string,
  locale: Locale,
): Promise<{ slug: string; label: string }> {
  const [row] = await db
    .select({ slug: eventTypes.slug, labels: eventTypes.labels })
    .from(eventTypes)
    .where(eq(eventTypes.id, eventTypeId))
    .limit(1);

  if (!row) return { slug: "unknown", label: "—" };

  return { slug: row.slug, label: pickLabel(row.labels, locale, row.slug) };
}

// ── The approvals queue ──────────────────────────────────────────────────────

/** One receipt waiting on a decision, with enough context to judge it. */
export interface PendingApproval {
  submissionId: string;
  eventId: string;
  eventTitle: string;
  publicToken: string;
  organizerToken: string;
  participantName: string;
  policyLabels: Record<string, string> | null;
  policySlug: string;
  /** The participant's own words: a transfer reference, "paid in cash". */
  note: string | null;
  submittedAt: Date;
  /** Whether there is an image to look at before deciding. */
  hasEvidence: boolean;
}

/**
 * Everything the organizer still has to decide, across every event they own.
 *
 * Oldest first: somebody who sent a receipt on Monday has been waiting longer
 * than somebody who sent one an hour ago, and a queue that buries them under
 * newer arrivals is a queue that never clears its tail.
 *
 * One query rather than one per event. An organizer with a season of weekly
 * matches has a dozen events open at once, and the page that exists to save
 * them steps should not spend a round trip per event to build itself.
 */
export async function loadPendingApprovals(organizerId: string): Promise<PendingApproval[]> {
  const rows = await db
    .select({
      submissionId: policySubmissions.id,
      eventId: events.id,
      eventTitle: events.title,
      publicToken: events.publicToken,
      organizerToken: events.organizerToken,
      participantName: participants.displayName,
      policyLabels: policyDefinitions.labels,
      policySlug: policyDefinitions.slug,
      note: policySubmissions.note,
      submittedAt: policySubmissions.createdAt,
      evidenceId: policyEvidence.submissionId,
    })
    .from(policySubmissions)
    .innerJoin(eventPolicies, eq(policySubmissions.policyId, eventPolicies.id))
    .innerJoin(events, eq(eventPolicies.eventId, events.id))
    .innerJoin(participants, eq(policySubmissions.participantId, participants.id))
    .innerJoin(policyDefinitions, eq(eventPolicies.policyDefinitionId, policyDefinitions.id))
    .leftJoin(policyEvidence, eq(policyEvidence.submissionId, policySubmissions.id))
    .where(and(eq(events.organizerId, organizerId), eq(policySubmissions.status, "submitted")))
    .orderBy(asc(policySubmissions.createdAt));

  return rows.map((row) => ({
    submissionId: row.submissionId,
    eventId: row.eventId,
    eventTitle: row.eventTitle,
    publicToken: row.publicToken,
    organizerToken: row.organizerToken,
    participantName: row.participantName,
    policyLabels: row.policyLabels as Record<string, string> | null,
    policySlug: row.policySlug,
    note: row.note,
    submittedAt: row.submittedAt,
    hasEvidence: row.evidenceId !== null,
  }));
}

export type {
  ParticipantRosterMember,
  ParticipantRosterView,
} from "@/domain/roster-projection";
export { toParticipantView } from "@/domain/roster-projection";
