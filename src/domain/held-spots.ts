/**
 * Spots held for guests: the rules.
 *
 * A held spot is capacity and cost reserved by somebody ON the roster for
 * somebody not yet on it. Three rules carry the feature, and each answers to
 * a different concern:
 *
 * - **Holding is answering.** It changes the headcount, so everything that
 *   gates the "¿vienes?" gates this too — the convocatoria deadline included.
 * - **Claiming is not.** The seat is already counted and already owed; a
 *   claim only moves it from the sponsor's name to its owner's. So claims
 *   stay open past the RSVP deadline — turning away the very person the spot
 *   was held FOR, at the door, would make the feature a trap.
 * - **The name is a courtesy, never a requirement, and never an email.** The
 *   claim link travels by the sponsor's own WhatsApp; Junti never contacts
 *   anyone who has not said yes. That is the product's standing promise, and
 *   this feature was reshaped to fit it rather than the other way around.
 */

/** Fallback per-sponsor cap; the live value comes from `app_settings`. */
export const DEFAULT_MAX_HELD_SPOTS = 5;

export interface SponsorState {
  /** The sponsor's own attendance. Only somebody attending may hold seats. */
  attendance: string;
  /** Spots this sponsor already holds (claimed ones stopped counting). */
  alreadyHeld: number;
  /** Free seats on the event right now, or null for unlimited capacity. */
  openSlots: number | null;
  /** The live per-sponsor cap. */
  maxHeldSpots: number;
}

export type HoldProblem = "not_attending" | "over_allowance" | "over_capacity";

/**
 * Whether a sponsor may hold `requested` MORE spots, and if not, why.
 *
 * Capacity is checked against the whole request, not spot by spot: holding
 * three seats of a two-seat remainder must fail whole rather than silently
 * grab two — a sponsor bringing three friends cannot leave one at home
 * because the software rounded down for them.
 */
export function holdProblem(requested: number, sponsor: SponsorState): HoldProblem | null {
  if (sponsor.attendance !== "in") return "not_attending";
  if (requested < 1 || sponsor.alreadyHeld + requested > sponsor.maxHeldSpots) {
    return "over_allowance";
  }
  if (sponsor.openSlots !== null && requested > sponsor.openSlots) return "over_capacity";
  return null;
}

/**
 * What an unnamed spot is called. The sponsor's name, not a number first:
 * "Invitado de Juan" tells the roster who answers for the seat, which is the
 * one thing everyone reading it wants to know.
 */
export function defaultGuestName(sponsorName: string, ordinal: number): string {
  return ordinal > 1 ? `Invitado de ${sponsorName} (${ordinal})` : `Invitado de ${sponsorName}`;
}

export interface ClaimState {
  /** Already claimed by someone (possibly the same account retrying). */
  claimedBy: string | null;
  /** The claimant is already a participant of this event themselves. */
  alreadyParticipant: boolean;
  /** The claimant IS the sponsor. Claiming your own held spot is a no-op. */
  isSponsor: boolean;
  eventCancelled: boolean;
  eventClosed: boolean;
}

export type ClaimProblem = "taken" | "own_spot" | "already_in" | "event_over";

/**
 * Whether this account may claim this spot.
 *
 * Note what is ABSENT: the RSVP deadline. The seat was counted and owed when
 * it was held; a claim changes whose name is on it, not how many are coming.
 */
export function claimProblem(state: ClaimState): ClaimProblem | null {
  if (state.eventCancelled || state.eventClosed) return "event_over";
  if (state.claimedBy !== null) return "taken";
  if (state.isSponsor) return "own_spot";
  if (state.alreadyParticipant) return "already_in";
  return null;
}

/**
 * When an unclaimed guest name stops serving its purpose.
 *
 * The name exists to tell spots apart BEFORE the match; after it, an
 * unclaimed name is personal data about a non-user with no remaining use —
 * so the retention sweep nulls it (the row survives: deleting it would
 * rewrite what the sponsor owed). Seven days of grace covers the "we played
 * Saturday, Pedro signed up Monday" case without keeping names for a season.
 */
export const GUEST_NAME_RETENTION_DAYS = 7;

export function guestNamePurgeDue(eventStartsAt: Date, now: Date): boolean {
  return now.getTime() - eventStartsAt.getTime() > GUEST_NAME_RETENTION_DAYS * 86_400_000;
}
