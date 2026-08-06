import { describe, expect, it } from "vitest";

import {
  canAnswer,
  countdownParts,
  deadlineFromLead,
  deadlineProblem,
  leadFromDeadline,
  remaining,
  rsvpState,
  urgency,
} from "./convocation";

/**
 * The rules that decide whether somebody may still say they are coming.
 *
 * Worth testing rather than reviewing because every one of them is a boundary,
 * and boundaries are where "closes at 6" and "closed at 6" turn out to disagree.
 */

const at = (iso: string) => new Date(iso);
const OPEN = { cancelledAt: null, closedAt: null, rsvpDeadline: null };

describe("whether an event is taking answers", () => {
  it("is open with no deadline at all", () => {
    expect(rsvpState(OPEN, at("2026-08-10T00:00:00Z"))).toBe("open");
    expect(canAnswer(OPEN, at("2026-08-10T00:00:00Z"))).toBe(true);
  });

  it("is open right up to the deadline", () => {
    const event = { ...OPEN, rsvpDeadline: at("2026-08-10T18:00:00Z") };
    expect(rsvpState(event, at("2026-08-10T17:59:59Z"))).toBe("open");
  });

  /**
   * The boundary itself. "Closes at 18:00" has to mean 18:00:00 is too late,
   * or a countdown showing 00:00 sits above a form that still works.
   */
  it("is expired at exactly the deadline, not a second after", () => {
    const event = { ...OPEN, rsvpDeadline: at("2026-08-10T18:00:00Z") };
    expect(rsvpState(event, at("2026-08-10T18:00:00Z"))).toBe("expired");
    expect(canAnswer(event, at("2026-08-10T18:00:00Z"))).toBe(false);
  });

  it("prefers the reason the organizer chose over the one the clock would give", () => {
    // Frozen by hand AND past its deadline: the hand-closing is the fact worth
    // reporting, because it is the one somebody decided.
    const event = {
      cancelledAt: null,
      closedAt: at("2026-08-09T00:00:00Z"),
      rsvpDeadline: at("2026-08-10T18:00:00Z"),
    };
    expect(rsvpState(event, at("2026-08-11T00:00:00Z"))).toBe("closed");
  });

  it("lets cancelled outrank everything", () => {
    const event = {
      cancelledAt: at("2026-08-09T00:00:00Z"),
      closedAt: at("2026-08-09T00:00:00Z"),
      rsvpDeadline: at("2026-08-10T18:00:00Z"),
    };
    expect(rsvpState(event, at("2026-08-11T00:00:00Z"))).toBe("cancelled");
  });

  /** Extending the deadline reopens it — the whole reason this is computed. */
  it("reopens when the deadline is pushed past now", () => {
    const now = at("2026-08-10T19:00:00Z");
    const expired = { ...OPEN, rsvpDeadline: at("2026-08-10T18:00:00Z") };
    expect(rsvpState(expired, now)).toBe("expired");

    const extended = { ...OPEN, rsvpDeadline: at("2026-08-10T20:00:00Z") };
    expect(rsvpState(extended, now)).toBe("open");
  });
});

describe("what makes a deadline nonsense", () => {
  const now = at("2026-08-01T00:00:00Z");
  const startsAt = at("2026-08-10T18:00:00Z");

  it("accepts one between now and kick-off", () => {
    expect(deadlineProblem(at("2026-08-09T18:00:00Z"), startsAt, now)).toBeNull();
  });

  it("rejects one already past", () => {
    expect(deadlineProblem(at("2026-07-31T00:00:00Z"), startsAt, now)).toBe("past");
    // Exactly now is past too: it would be born closed.
    expect(deadlineProblem(now, startsAt, now)).toBe("past");
  });

  it("rejects one at or after kick-off", () => {
    expect(deadlineProblem(at("2026-08-11T00:00:00Z"), startsAt, now)).toBe("after_start");
    // At kick-off closes nothing — everybody coming has already arrived.
    expect(deadlineProblem(startsAt, startsAt, now)).toBe("after_start");
  });
});

describe("the lead the organizer picks", () => {
  const startsAt = at("2026-08-10T18:00:00Z");

  it("round-trips every option, so the edit form shows back what was chosen", () => {
    for (const lead of [2, 6, 24, 48, 72, 168] as const) {
      expect(leadFromDeadline(startsAt, deadlineFromLead(startsAt, lead))).toBe(lead);
    }
  });

  it("counts back from kick-off", () => {
    expect(deadlineFromLead(startsAt, 24)).toEqual(at("2026-08-09T18:00:00Z"));
    expect(deadlineFromLead(startsAt, 168)).toEqual(at("2026-08-03T18:00:00Z"));
  });

  it("admits it does not recognise a deadline set some other way", () => {
    expect(leadFromDeadline(startsAt, at("2026-08-10T05:13:00Z"))).toBeNull();
  });

  /**
   * The lead is applied against whatever start time is being saved, so moving
   * the event moves the deadline with it. This is the whole reason the form
   * asks for a lead rather than a date.
   */
  it("follows the event when it moves", () => {
    const moved = at("2026-08-11T18:00:00Z");
    expect(deadlineFromLead(moved, 24)).toEqual(at("2026-08-10T18:00:00Z"));
  });

  /** A week's notice on an event that is tomorrow closed before it was set. */
  it("can produce a deadline that is already past, which validation must catch", () => {
    const now = at("2026-08-09T18:00:00Z");
    const deadline = deadlineFromLead(startsAt, 168);
    expect(deadlineProblem(deadline, startsAt, now)).toBe("past");
  });
});

describe("how long is left", () => {
  const deadline = at("2026-08-10T18:00:00Z");

  it("splits into the units a clock shows", () => {
    expect(remaining(deadline, at("2026-08-08T15:29:50Z"))).toEqual({
      days: 2,
      hours: 2,
      minutes: 30,
      seconds: 10,
      totalMs: 181_810_000,
    });
  });

  it("truncates like a clock rather than rounding", () => {
    // 90 seconds is "1 minute 30 seconds", never "2 minutes".
    const left = remaining(deadline, at("2026-08-10T17:58:30Z"));
    expect(left.minutes).toBe(1);
    expect(left.seconds).toBe(30);
  });

  /**
   * The viewer's clock is not the server's. A machine running a few seconds
   * fast would otherwise render negative numbers in the one component whose
   * whole job is to be trusted about time.
   */
  it("never goes negative", () => {
    const left = remaining(deadline, at("2026-08-10T18:05:00Z"));
    expect(left).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
  });
});

describe("what the countdown shows", () => {
  const deadline = at("2026-08-10T18:00:00Z");
  const parts = (iso: string) => countdownParts(remaining(deadline, at(iso)));

  it("slides down a unit as the deadline approaches", () => {
    expect(parts("2026-08-08T15:29:50Z")).toEqual([
      { value: 2, unit: "day" },
      { value: 2, unit: "hour" },
    ]);
    expect(parts("2026-08-10T15:29:50Z")).toEqual([
      { value: 2, unit: "hour" },
      { value: 30, unit: "minute" },
    ]);
    expect(parts("2026-08-10T17:29:50Z")).toEqual([
      { value: 30, unit: "minute" },
      { value: 10, unit: "second" },
    ]);
  });

  /**
   * "2 días" alone would make the row jump between one number and two as the
   * hours roll over, which reads as the display breaking rather than time
   * passing.
   */
  it("keeps a zero inside the pair rather than dropping to one number", () => {
    expect(parts("2026-08-08T18:00:00Z")).toEqual([
      { value: 2, unit: "day" },
      { value: 0, unit: "hour" },
    ]);
  });

  it("shows zeroes rather than nothing once it is over", () => {
    expect(parts("2026-08-11T00:00:00Z")).toEqual([
      { value: 0, unit: "minute" },
      { value: 0, unit: "second" },
    ]);
  });
});

describe("urgency", () => {
  const deadline = at("2026-08-10T18:00:00Z");
  const tier = (iso: string) => urgency(remaining(deadline, at(iso)));

  it("escalates as the hours run out", () => {
    expect(tier("2026-08-08T18:00:00Z")).toBe("calm");
    expect(tier("2026-08-10T10:00:00Z")).toBe("soon");
    expect(tier("2026-08-10T17:30:00Z")).toBe("urgent");
  });

  it("is measured in hours, not in a share of the window", () => {
    // One hour left reads the same whether the call ran a day or three weeks.
    expect(tier("2026-08-10T17:00:00Z")).toBe("urgent");
  });
});
