/**
 * The floor: how many people have to be coming for the plan to be worth doing.
 *
 * `capacity` says when to stop letting people in; this says when there are
 * enough to bother. It exists for the failure that costs real money — four
 * people at a cancha booked for ten, with somebody covering six empty seats —
 * and for the one that costs more than money: arriving on the day to find
 * nobody there.
 *
 * **Nothing here decides anything.** The organizer judges whether to go ahead,
 * postpone or call it off, exactly as Ivan framed it, so this module only turns
 * a count into a fact both sides can read. No auto-cancel, no auto-postpone —
 * the same rule that keeps the waitlist from promoting people by itself.
 */

export type QuorumState =
  /** No minimum was ever stated: nothing to judge, and no UI to show. */
  | "unset"
  /** Enough people are coming. */
  | "met"
  /** Still short of the floor. */
  | "short";

export interface Quorum {
  state: QuorumState;
  /** How many more are needed. Zero unless `short`. */
  missing: number;
  /** The floor itself, echoed for the sentence that reports it. Zero when unset. */
  minimum: number;
}

/**
 * Judges a headcount against the stated floor.
 *
 * `attendingUnits` is SEATS, not rows — a sponsor holding three guest spots
 * brings four people to the field, and a quorum that counted rows would call
 * that one. Same unit the capacity check uses, so the two can never disagree
 * about how full the event is.
 *
 * A null or non-positive minimum is "unset": zero would be a stated policy
 * ("it happens no matter what") and there is nothing to report about it, while
 * a negative is nonsense the validation layer already rejects.
 */
export function quorumOf(attendingUnits: number, minAttendees: number | null): Quorum {
  if (minAttendees === null || minAttendees <= 0) {
    return { state: "unset", missing: 0, minimum: 0 };
  }

  const missing = Math.max(0, minAttendees - attendingUnits);

  return {
    state: missing === 0 ? "met" : "short",
    missing,
    minimum: minAttendees,
  };
}
