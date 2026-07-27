import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { events, participants, payments } from "@/db/schema";
import type { EventRow, ParticipantRow, PaymentRow } from "@/db/schema";
import { computeSplit, type Share, type SplitParticipant } from "@/domain/split";
import type { Attendance } from "@/domain/types";
import { openSlots, promotableCount, waitlistOrder } from "@/domain/waitlist";

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
}

export interface EventView {
  id: string;
  publicToken: string;
  title: string;
  kind: EventRow["kind"];
  startsAt: Date;
  location: string | null;
  capacity: number | null;
  notes: string | null;
  costMode: EventRow["costMode"];
  costAmountMinor: number | null;
  currency: string;
  closedAt: Date | null;
  isClosed: boolean;
  hasCost: boolean;
}

export interface RosterView {
  event: EventView;
  members: RosterMember[];
  attending: RosterMember[];
  notAttending: RosterMember[];
  maybe: RosterMember[];
  waitlisted: RosterMember[];
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

function toEventView(row: EventRow): EventView {
  return {
    id: row.id,
    publicToken: row.publicToken,
    title: row.title,
    kind: row.kind,
    startsAt: row.startsAt,
    location: row.location,
    capacity: row.capacity,
    notes: row.notes,
    costMode: row.costMode,
    costAmountMinor: row.costAmountMinor,
    currency: row.currency,
    closedAt: row.closedAt,
    isClosed: row.closedAt !== null,
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

async function loadJoinedRows(eventId: string): Promise<JoinedRow[]> {
  const rows = await db
    .select({ participant: participants, payment: payments })
    .from(participants)
    .leftJoin(payments, eq(payments.participantId, participants.id))
    .where(eq(participants.eventId, eventId))
    .orderBy(asc(participants.createdAt), asc(participants.id));

  return rows;
}

/** Builds the full view of an event: roster, money, capacity. */
export async function loadRoster(eventRow: EventRow): Promise<RosterView> {
  const rows = await loadJoinedRows(eventRow.id);

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

  return {
    event: toEventView(eventRow),
    members,
    attending: members.filter((m) => m.attendance === "in"),
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

/** The raw participant + payment rows, for actions that need to write. */
export async function loadParticipantRows(eventId: string): Promise<JoinedRow[]> {
  return loadJoinedRows(eventId);
}
