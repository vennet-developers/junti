import { describe, expect, it } from "vitest";

import { pastRefundCutoff, refundCutoff, refundVerdict } from "./refund-policy";

/**
 * The refund rule's arithmetic. Worth pinning because every wrong answer here
 * is an argument between friends about real money: a verdict of "forfeit" on
 * somebody who did give notice is exactly the fight the feature exists to
 * prevent.
 */

const kickoff = new Date("2026-08-15T18:00:00-05:00");

describe("the cutoff", () => {
  it("sits the stated hours before kick-off", () => {
    expect(refundCutoff(kickoff, 24)).toEqual(new Date("2026-08-14T18:00:00-05:00"));
    expect(refundCutoff(kickoff, 48)).toEqual(new Date("2026-08-13T18:00:00-05:00"));
  });

  /** "At least 24 hours" includes the twenty-fourth. The boundary favours the person. */
  it("still qualifies exactly at the cutoff", () => {
    expect(pastRefundCutoff(new Date("2026-08-14T18:00:00-05:00"), kickoff, 24)).toBe(false);
    expect(pastRefundCutoff(new Date("2026-08-14T18:00:01-05:00"), kickoff, 24)).toBe(true);
  });
});

describe("the verdict", () => {
  it("refunds a dropout who gave the notice", () => {
    expect(
      refundVerdict({
        noticeHours: 24,
        startsAt: kickoff,
        outAt: new Date("2026-08-13T10:00:00-05:00"),
      }),
    ).toBe("refund");
  });

  /** The same-day bail Ivan named: money stays per the stated rule. */
  it("forfeits a same-day dropout", () => {
    expect(
      refundVerdict({
        noticeHours: 24,
        startsAt: kickoff,
        outAt: new Date("2026-08-15T09:00:00-05:00"),
      }),
    ).toBe("forfeit");
  });

  it("gives no verdict when the organizer stated no rule", () => {
    expect(refundVerdict({ noticeHours: null, startsAt: kickoff, outAt: kickoff })).toBeNull();
  });

  /**
   * A drop that predates `out_at` tracking is UNKNOWN, not either verdict —
   * accusing somebody of bailing late on missing evidence is worse than
   * admitting the app was not looking.
   */
  it("admits ignorance for a drop with no recorded instant", () => {
    expect(refundVerdict({ noticeHours: 24, startsAt: kickoff, outAt: null })).toBe("unknown");
  });
});
