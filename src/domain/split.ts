import { ATTENDING, type Attendance, type CostMode, type PaymentStatus } from "./types";

/**
 * Cost splitting.
 *
 * Pure functions over plain data — no framework, no database, no clock. This is
 * the part of the app with rules worth getting exactly right, because a bug
 * here means somebody is asked for money they don't owe, or the organizer eats
 * a shortfall they never see.
 *
 * All amounts are integers in the currency's minor unit. Never a float: money
 * arithmetic in binary floating point loses cents.
 */

export interface SplitParticipant {
  id: string;
  /** `created_at`. Decides who absorbs the rounding remainder. */
  joinedAt: Date;
  attendance: Attendance;
  /** Null when no payment row exists yet (cost mode `none`, or not yet created). */
  payment: { status: PaymentStatus; amountMinor: number } | null;
  /**
   * Shares this row answers for: 1 + spots held for guests. The sponsor of
   * three held spots owes four shares — the guests are not on the roster, so
   * the seats they occupy have to be paid for by the person who reserved
   * them. Defaults to 1; a claimed spot moves its share to the claimant by
   * ceasing to count here and appearing as their own row.
   */
  weight?: number;
}

export interface SplitInput {
  costMode: CostMode;
  /** Minor units. Null or absent when `costMode` is `none`. */
  costAmountMinor: number | null;
  participants: readonly SplitParticipant[];
  /**
   * The convocatoria's size. When set on a total-mode event, the QUOTA —
   * what each seat is asked to pay up front — is total/capacity, the number
   * the plan was agreed on ("$260.000 la cancha entre 10"). Without it there
   * is no planned denominator and the ask falls back to the live split.
   */
  capacity?: number | null;
}

export interface Share {
  participantId: string;
  /** What the current roster and cost say this person owes. */
  computedAmountMinor: number;
  /**
   * What the ledger should actually show. Equals `computedAmountMinor` except
   * for a confirmed payment, where the amount already handed over wins.
   */
  effectiveAmountMinor: number;
  status: PaymentStatus;
  /** False for out / maybe / waitlisted, and for everyone when there is no cost. */
  owes: boolean;
  /**
   * `effective - computed` for a confirmed payment whose share has since moved.
   * Zero otherwise. Positive means they overpaid, negative means they underpaid.
   */
  discrepancyMinor: number;
}

export interface Discrepancy {
  participantId: string;
  confirmedAmountMinor: number;
  computedAmountMinor: number;
  /** `confirmed - computed`. Positive: they paid too much. Negative: too little. */
  differenceMinor: number;
}

export interface SplitResult {
  shares: Share[];
  /** Sum of every computed share. For `total` mode this equals the event cost exactly. */
  totalComputedMinor: number;
  /** Money actually in the organizer's hands (status `confirmed`). */
  collectedMinor: number;
  /** Still owed (status `pending`). */
  outstandingMinor: number;
  /** Forgiven by the organizer (status `waived`) — neither collected nor owed. */
  waivedMinor: number;
  /**
   * Confirmed payments that no longer match the computed share. Surfaced to the
   * organizer as a warning; never reconciled automatically.
   */
  discrepancies: Discrepancy[];
}

/**
 * Orders participants the way the remainder is handed out: earliest joiner
 * first. Ties broken by id so the result is deterministic even when two rows
 * share a timestamp — otherwise the same input could produce two different
 * splits and the extra peso would appear to move between people.
 */
function byJoinOrder(a: SplitParticipant, b: SplitParticipant): number {
  const delta = a.joinedAt.getTime() - b.joinedAt.getTime();
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

/**
 * Splits `totalMinor` across `count` people as evenly as integers allow.
 *
 * Integer division leaves a remainder of at most `count - 1` minor units. Those
 * are handed out one at a time to the earliest joiners, so the shares sum to
 * exactly `totalMinor` — no cent is lost, and none is invented.
 *
 * Exported for direct testing: this is the arithmetic that must never be wrong.
 */
export function evenShares(totalMinor: number, count: number): number[] {
  if (count <= 0) return [];

  const base = Math.trunc(totalMinor / count);
  const remainder = totalMinor - base * count;

  // `remainder` carries the sign of `totalMinor`, so a negative total (which the
  // validation layer rejects, but which must not silently corrupt anything here)
  // still distributes correctly.
  const step = remainder < 0 ? -1 : 1;
  const extras = Math.abs(remainder);

  return Array.from({ length: count }, (_, index) => (index < extras ? base + step : base));
}

/**
 * Computes what every participant owes, and what the organizer has collected.
 *
 * The rules, precisely:
 *
 * - `none` — nobody owes anything and there is no money UI at all.
 * - `per_person` — every attending participant owes the full `costAmountMinor`.
 * - `total` — `costAmountMinor` is split evenly across attending participants,
 *   remainder to the earliest joiners.
 * - `out`, `maybe` and `waitlisted` owe nothing, and are not part of the
 *   denominator.
 * - A **confirmed** payment is never recomputed. That money already changed
 *   hands. If the split has moved since, the confirmed amount stands and the
 *   difference is reported in `discrepancies` for the organizer to sort out
 *   with that person directly.
 *
 * A `waived` share is still computed (so the organizer can see what was
 * forgiven) but counts as neither collected nor outstanding. A waived
 * participant still occupies a slot in the denominator — the cost does not
 * vanish, the organizer absorbs it.
 */
export function computeSplit(input: SplitInput): SplitResult {
  const { costMode, costAmountMinor, participants, capacity } = input;

  const attending = participants.filter((p) => p.attendance === ATTENDING).sort(byJoinOrder);

  const amounts = new Map<string, number>();

  /*
    Two different numbers per share, on purpose:

    - `computed` — the FINAL truth: the live split among whoever attends.
      Settlement compares confirmed money against this, which is what makes
      "Cuentas finales" able to say who still owes what after dropouts.
    - `planned` — the ASK: what a pending person is billed today. On a
      total-mode event with a capacity that is the convocatoria's quota
      (total/capacity × their seats), because "$260.000 entre 10 cupos" is
      the number people agreed to transfer — NOT the live split, which
      starts at the full total for the first person in and reads as the app
      charging them the event. Everywhere else the two coincide.
  */
  const planned = new Map<string, number>();

  if (costMode === "total" && costAmountMinor !== null && capacity && capacity > 0) {
    const unitQuotas = evenShares(costAmountMinor, capacity);
    let cursor = 0;
    for (const participant of attending) {
      const weight = participant.weight ?? 1;
      let amount = 0;
      for (let i = 0; i < weight; i++) {
        // Units past the convocatoria's size (guests squeezed in over
        // capacity) still pay a quota — the last one's, the base rate.
        amount += unitQuotas[Math.min(cursor++, unitQuotas.length - 1)] ?? 0;
      }
      planned.set(participant.id, amount);
    }
  }

  if (costMode === "per_person" && costAmountMinor !== null) {
    for (const participant of attending) {
      amounts.set(participant.id, costAmountMinor * (participant.weight ?? 1));
    }
  } else if (costMode === "total" && costAmountMinor !== null) {
    /*
      The units being split are SEATS, not rows. Splitting by row would hand
      the sponsor of three guests the same share as everyone else and quietly
      spread their guests' cost across the whole roster. Units are dealt in
      join order, so the rounding remainder still lands on the earliest
      joiners — one unit at a time, exactly as before weights existed.
    */
    const totalUnits = attending.reduce((sum, p) => sum + (p.weight ?? 1), 0);
    const units = evenShares(costAmountMinor, totalUnits);
    let cursor = 0;
    for (const participant of attending) {
      const weight = participant.weight ?? 1;
      let amount = 0;
      for (let i = 0; i < weight; i++) amount += units[cursor++] ?? 0;
      amounts.set(participant.id, amount);
    }
  }

  const shares: Share[] = [];
  const discrepancies: Discrepancy[] = [];

  let totalComputedMinor = 0;
  let collectedMinor = 0;
  let outstandingMinor = 0;
  let waivedMinor = 0;

  for (const participant of participants) {
    const computedAmountMinor = amounts.get(participant.id) ?? 0;
    const owes = costMode !== "none" && participant.attendance === ATTENDING;
    const status = participant.payment?.status ?? "pending";

    totalComputedMinor += computedAmountMinor;

    let effectiveAmountMinor = planned.get(participant.id) ?? computedAmountMinor;
    let discrepancyMinor = 0;

    if (status === "confirmed" && participant.payment) {
      // Money already handed over. Keep it, and report the drift instead of
      // quietly rewriting history.
      effectiveAmountMinor = participant.payment.amountMinor;
      discrepancyMinor = effectiveAmountMinor - computedAmountMinor;

      if (discrepancyMinor !== 0) {
        discrepancies.push({
          participantId: participant.id,
          confirmedAmountMinor: effectiveAmountMinor,
          computedAmountMinor,
          differenceMinor: discrepancyMinor,
        });
      }

      collectedMinor += effectiveAmountMinor;
    } else if (status === "waived") {
      waivedMinor += effectiveAmountMinor;
    } else if (owes) {
      outstandingMinor += effectiveAmountMinor;
    }

    shares.push({
      participantId: participant.id,
      computedAmountMinor,
      effectiveAmountMinor,
      status,
      owes,
      discrepancyMinor,
    });
  }

  return {
    shares,
    totalComputedMinor,
    collectedMinor,
    outstandingMinor,
    waivedMinor,
    discrepancies,
  };
}
