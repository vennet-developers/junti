import { ATTENDING, type Attendance } from "./types";

/**
 * Capacity and waitlist rules.
 *
 * Pure functions over plain data. The load-bearing decision here is that
 * promotion is never automatic: when a slot frees up the organizer is told, and
 * they promote explicitly. Silent promotion means somebody shows up thinking
 * they are not playing, or doesn't show up because nobody told them they were.
 */

export interface WaitlistParticipant {
  /** Seats this row occupies: 1 + spots held for guests. @default 1 */
  weight?: number;
  id: string;
  /** `created_at`. Decides waitlist position. */
  joinedAt: Date;
  attendance: Attendance;
}

/** Earliest joiner first. Ties broken by id so ordering is deterministic. */
function byJoinOrder(a: WaitlistParticipant, b: WaitlistParticipant): number {
  const delta = a.joinedAt.getTime() - b.joinedAt.getTime();
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

/** How many people currently occupy a slot. Only `in` counts. */
export function countAttending(participants: readonly WaitlistParticipant[]): number {
  /*
    Weights, not headcount. A participant bringing three guests occupies four
    seats, and counting rows instead of seats is how an event for ten ends up
    with thirteen people at the pitch. Weight defaults to 1, so every caller
    that predates held spots is unchanged.
  */
  return participants
    .filter((p) => p.attendance === ATTENDING)
    .reduce((sum, p) => sum + (p.weight ?? 1), 0);
}

/**
 * The waitlist, in the order people should be promoted.
 *
 * Ordered by `joinedAt` ascending — first to ask is first to get in.
 */
export function waitlistOrder<T extends WaitlistParticipant>(participants: readonly T[]): T[] {
  return participants.filter((p) => p.attendance === "waitlisted").sort(byJoinOrder);
}

/**
 * Free slots right now. Null capacity means unlimited.
 *
 * Never negative: if the organizer lowers capacity below the number already
 * attending, there are zero free slots, not "minus three".
 */
export function openSlots(
  capacity: number | null,
  participants: readonly WaitlistParticipant[],
): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - countAttending(participants));
}

/** True when a new `in` RSVP would have to go on the waitlist instead. */
export function isFull(
  capacity: number | null,
  participants: readonly WaitlistParticipant[],
): boolean {
  const slots = openSlots(capacity, participants);
  return slots !== null && slots === 0;
}

/**
 * How many waitlisted people could be promoted right now.
 *
 * This is what the organizer view surfaces as "a slot opened". It is a prompt,
 * not an action — nothing is promoted until they say so.
 */
export function promotableCount(
  capacity: number | null,
  participants: readonly WaitlistParticipant[],
): number {
  const waiting = waitlistOrder(participants).length;
  if (waiting === 0) return 0;

  const slots = openSlots(capacity, participants);
  // Unlimited capacity with people still on the waitlist can happen if the
  // organizer removes the cap after a full event. All of them can go in.
  if (slots === null) return waiting;

  return Math.min(slots, waiting);
}

/**
 * Decides the attendance actually stored when somebody RSVPs.
 *
 * `out` and `maybe` are always honoured — they never occupy a slot, so capacity
 * is irrelevant. A request to attend becomes `waitlisted` when the event is
 * full.
 *
 * `existing` is the participant's current attendance when they are amending an
 * earlier RSVP, or null for a new one. It matters because somebody who is
 * already `in` must not be bumped to the waitlist by re-submitting the same
 * answer — they already hold their slot, and `countAttending` already includes
 * them.
 */
export function resolveAttendance(params: {
  requested: Exclude<Attendance, "waitlisted">;
  capacity: number | null;
  participants: readonly WaitlistParticipant[];
  existing: Attendance | null;
}): Attendance {
  const { requested, capacity, participants, existing } = params;

  if (requested !== ATTENDING) return requested;

  // Already holding a slot — re-confirming must never cost them that slot.
  if (existing === ATTENDING) return ATTENDING;

  return isFull(capacity, participants) ? "waitlisted" : ATTENDING;
}
