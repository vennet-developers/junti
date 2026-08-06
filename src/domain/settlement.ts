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
      A negative discrepancy on an attending, confirmed payer IS the
      shortfall: they paid the old share and the roster moved under them.
      Positive discrepancies (paid more than the final share) are deliberately
      NOT listed as refunds here — over-payment among friends usually stays in
      the pot, and telling the organizer to hand money back is not this
      module's call.
    */
    if (share.status === "confirmed" && attending && share.discrepancyMinor < 0) {
      topUps.push({
        participantId: share.participantId,
        paidMinor: share.effectiveAmountMinor,
        finalShareMinor: share.computedAmountMinor,
        missingMinor: -share.discrepancyMinor,
      });
    }
  }

  return {
    topUps,
    shortfallMinor: topUps.reduce((sum, topUp) => sum + topUp.missingMinor, 0),
    refundables,
  };
}
