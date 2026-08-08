import type { Share } from "./split";

/**
 * The post-event settlement: who still owes what, once the roster is real.
 *
 * The scenario this exists for: a cancha for $160.000 split among ten, eight
 * of whom paid early at $16.000 — then two dropped out. The split over the
 * remaining eight is $20.000, and everyone PENDING adjusts automatically
 * (`planLedger` rewrites pending amounts on every sync). What does not move
 * is confirmed money: those payments are history, and the $4.000 gap per
 * early payer lives only in `discrepancies` — data the organizer never sees
 * as an action. Without this module, that gap comes out of their pocket.
 *
 * The flagship case is `total` mode — that is where a smaller roster raises
 * everyone's share — but the module works on any frozen payment whose share
 * rose after it was confirmed, which also covers an organizer raising a
 * per-person price. What it never does is chase money on its own: it turns
 * discrepancies into sentences, and the organizer does the asking.
 *
 * Pure over `Share[]` so the arithmetic is testable without a database — and
 * because the numbers here are exactly the ones `computeSplit` already
 * produces. This module never invents an amount; it turns discrepancies into
 * sentences.
 */

export interface TopUp {
  participantId: string;
  /** What they handed over, frozen at confirmation. */
  paidMinor: number;
  /** Their share at today's roster. */
  finalShareMinor: number;
  /** `finalShare - paid`. Always positive here. */
  missingMinor: number;
}

/**
 * A confirmed payer who handed over MORE than their share turned out to be.
 *
 * The mirror of {@link TopUp}, and it exists now because the drift stopped
 * being drift. It used to be a few pesos of rounding, which is why this
 * module deliberately said nothing: "over-payment among friends usually
 * stays in the pot". Then Ivan let two extra people into a ten-cupo game and
 * ten people were suddenly $4.333 each ahead — money with ten named owners,
 * which the organizer is holding and nobody was told about.
 *
 * Listing it is not the same as demanding it back. The organizer picks: hand
 * it over, or agree it stays where it is. The app only refuses to keep the
 * secret.
 */
export interface Overpayment {
  participantId: string;
  /** What they handed over, frozen at confirmation. */
  paidMinor: number;
  /** Their share at today's roster. */
  finalShareMinor: number;
  /** `paid - finalShare`. Always positive here. */
  extraMinor: number;
}

export interface Refundable {
  participantId: string;
  /** Confirmed money held for somebody who no longer attends. */
  paidMinor: number;
}

export interface Settlement {
  /** Confirmed payers whose share ROSE after they paid. */
  topUps: TopUp[];
  /** Sum of everything the top-ups would recover. */
  shortfallMinor: number;
  /** Confirmed payers whose share FELL after they paid. */
  overpayments: Overpayment[];
  /** Sum of everything the overpayments are holding. */
  surplusMinor: number;
  /**
   * Money already in hand from people who left the roster. Reported, never
   * redistributed automatically: whether to refund a dropout or count their
   * money toward the pot is between them and the organizer, and either answer
   * changes what the attendees still owe. The app states the fact.
   */
  refundables: Refundable[];
}

export function computeSettlement(
  shares: readonly Share[],
  attendanceOf: (participantId: string) => string,
): Settlement {
  const topUps: TopUp[] = [];
  const overpayments: Overpayment[] = [];
  const refundables: Refundable[] = [];

  for (const share of shares) {
    const attending = attendanceOf(share.participantId) === "in";

    if (share.status === "confirmed" && !attending && share.effectiveAmountMinor > 0) {
      refundables.push({
        participantId: share.participantId,
        paidMinor: share.effectiveAmountMinor,
      });
      continue;
    }

    /*
      A drift the organizer already agreed to leave alone is not a question
      any more — see `discrepancyAccepted`. Skipping it here rather than in
      the card keeps every reader of this module agreeing about what is
      still open.
    */
    if (share.discrepancyAccepted) continue;

    /*
      Both directions, now. A negative discrepancy is the shortfall: they
      paid the old share and the roster moved under them. A positive one is
      the reverse — the roster GREW and their share fell, so the organizer is
      holding money that belongs to them.

      Neither is an instruction. This module turns discrepancies into
      sentences and the organizer does the deciding, which is why the
      overpayment carries no "refund" in its name: handing it back and
      agreeing it stays are both legitimate answers.
    */
    if (share.status === "confirmed" && attending && share.discrepancyMinor < 0) {
      topUps.push({
        participantId: share.participantId,
        paidMinor: share.effectiveAmountMinor,
        finalShareMinor: share.computedAmountMinor,
        missingMinor: -share.discrepancyMinor,
      });
    }

    if (share.status === "confirmed" && attending && share.discrepancyMinor > 0) {
      overpayments.push({
        participantId: share.participantId,
        paidMinor: share.effectiveAmountMinor,
        finalShareMinor: share.computedAmountMinor,
        extraMinor: share.discrepancyMinor,
      });
    }
  }

  return {
    topUps,
    shortfallMinor: topUps.reduce((sum, topUp) => sum + topUp.missingMinor, 0),
    overpayments,
    surplusMinor: overpayments.reduce((sum, over) => sum + over.extraMinor, 0),
    refundables,
  };
}
