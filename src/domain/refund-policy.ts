/**
 * The organizer's refund rule: how much notice a dropout owes before their
 * money comes back.
 *
 * Junti never holds the money, so nothing here moves a peso. What the rule
 * buys is being SAID at the two moments it settles arguments: on the form
 * before somebody confirms a paid spot ("this is what backing out late
 * costs"), and on the settlement card when the organizer decides whose money
 * goes back ("Ana avisó a tiempo, Beto no").
 *
 * Pure functions over instants, like the rest of `src/domain`: no ORM, no
 * React, and no clock of its own — every question takes the moment it is
 * being asked about, because "did they give enough notice" is decided by when
 * the answer changed, not by when anybody looked.
 */

/**
 * The windows the form offers, in hours. A closed list, like the RSVP leads:
 * the column stores any integer, so widening this is a copy change, not a
 * migration.
 */
export const REFUND_NOTICE_CHOICES = [24, 48] as const;

export function isRefundNoticeHours(value: number): boolean {
  return (REFUND_NOTICE_CHOICES as readonly number[]).includes(value);
}

/**
 * The last instant a dropout still qualifies for a refund.
 *
 * Derived from the start time on every ask rather than stored, for the same
 * reason `rsvpDeadline` is recomputed when an event moves: an organizer who
 * postpones the game by a week must not drag the old cutoff along.
 */
export function refundCutoff(startsAt: Date, noticeHours: number): Date {
  return new Date(startsAt.getTime() - noticeHours * 60 * 60_000);
}

/**
 * Whether backing out AT this moment forfeits the money.
 *
 * Exactly at the cutoff still qualifies — "at least 24 hours" includes the
 * twenty-fourth. The boundary favours the person, because the rule exists to
 * be safe to rely on, not to be a trap with a seconds hand.
 */
export function pastRefundCutoff(at: Date, startsAt: Date, noticeHours: number): boolean {
  return at.getTime() > refundCutoff(startsAt, noticeHours).getTime();
}

/**
 * What the policy says about one dropout's money.
 *
 * - `refund` — they gave the notice; their money goes back.
 * - `forfeit` — they backed out inside the window; the policy keeps it.
 * - `unknown` — a policy exists but the drop predates `out_at` tracking.
 *   Reported as its own value rather than defaulting to either verdict:
 *   accusing somebody of bailing late on missing evidence is worse than
 *   admitting the app was not looking.
 *
 * `null` — the organizer never stated a rule, so there is no verdict to give.
 */
export type RefundVerdict = "refund" | "forfeit" | "unknown";

export function refundVerdict(input: {
  noticeHours: number | null;
  startsAt: Date;
  outAt: Date | null;
}): RefundVerdict | null {
  if (input.noticeHours === null) return null;
  if (input.outAt === null) return "unknown";

  return pastRefundCutoff(input.outAt, input.startsAt, input.noticeHours) ? "forfeit" : "refund";
}
