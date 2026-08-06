import { describe, expect, it } from "vitest";

import {
  claimProblem,
  defaultGuestName,
  guestNamePurgeDue,
  holdProblem,
} from "./held-spots";
import { computeSplit } from "./split";
import { openSlots, resolveAttendance } from "./waitlist";

/**
 * The rules for bringing guests. Tested hard because every one is money or a
 * seat: a wrong weight bills the roster for someone else's friends, and a
 * wrong capacity check leaves somebody standing at the pitch.
 */

const SPONSOR = { attendance: "in", alreadyHeld: 0, openSlots: 6, maxHeldSpots: 5 };

describe("who may hold spots, and how many", () => {
  it("lets an attending participant hold up to the cap", () => {
    expect(holdProblem(3, SPONSOR)).toBeNull();
    expect(holdProblem(5, SPONSOR)).toBeNull();
  });

  it("counts what they already hold against the allowance", () => {
    expect(holdProblem(3, { ...SPONSOR, alreadyHeld: 3 })).toBe("over_allowance");
    expect(holdProblem(2, { ...SPONSOR, alreadyHeld: 3 })).toBeNull();
  });

  it("refuses anyone not attending — a maybe cannot reserve seats", () => {
    expect(holdProblem(1, { ...SPONSOR, attendance: "maybe" })).toBe("not_attending");
    expect(holdProblem(1, { ...SPONSOR, attendance: "waitlisted" })).toBe("not_attending");
  });

  /**
   * Whole or nothing: three friends of a two-seat remainder must fail, not
   * silently hold two and leave one at home.
   */
  it("checks capacity against the whole request", () => {
    expect(holdProblem(3, { ...SPONSOR, openSlots: 2 })).toBe("over_capacity");
    expect(holdProblem(2, { ...SPONSOR, openSlots: 2 })).toBeNull();
    expect(holdProblem(3, { ...SPONSOR, openSlots: null })).toBeNull(); // sin límite
  });

  it("rejects zero and negative requests", () => {
    expect(holdProblem(0, SPONSOR)).toBe("over_allowance");
    expect(holdProblem(-2, SPONSOR)).toBe("over_allowance");
  });
});

describe("what an unnamed guest is called", () => {
  it("names the sponsor, because that is who answers for the seat", () => {
    expect(defaultGuestName("Juan", 1)).toBe("Invitado de Juan");
    expect(defaultGuestName("Juan", 3)).toBe("Invitado de Juan (3)");
  });
});

describe("who may claim a spot", () => {
  const OPEN = {
    claimedBy: null,
    alreadyParticipant: false,
    isSponsor: false,
    eventCancelled: false,
    eventClosed: false,
  };

  it("lets a signed-in stranger claim an open spot", () => {
    expect(claimProblem(OPEN)).toBeNull();
  });

  it("refuses a spot somebody else took first", () => {
    expect(claimProblem({ ...OPEN, claimedBy: "u2" })).toBe("taken");
  });

  it("refuses the sponsor and anyone already on the roster", () => {
    expect(claimProblem({ ...OPEN, isSponsor: true })).toBe("own_spot");
    expect(claimProblem({ ...OPEN, alreadyParticipant: true })).toBe("already_in");
  });

  it("dies with the event, not with the RSVP deadline", () => {
    // No deadline field exists in ClaimState at all — the seat is already
    // counted, so the convocatoria has nothing to say about whose name is on
    // it. Only a closed or cancelled event refuses.
    expect(claimProblem({ ...OPEN, eventClosed: true })).toBe("event_over");
    expect(claimProblem({ ...OPEN, eventCancelled: true })).toBe("event_over");
  });
});

describe("weights carry the guests through money and capacity", () => {
  const base = { joinedAt: new Date("2026-08-01T00:00:00Z"), attendance: "in" as const, payment: null };

  it("bills the sponsor for every seat they hold, per person", () => {
    const { shares } = computeSplit({
      costMode: "per_person",
      costAmountMinor: 20_000,
      participants: [
        { ...base, id: "juan", weight: 4 },
        { ...base, id: "ana" },
      ],
    });
    expect(shares.find((s) => s.participantId === "juan")?.computedAmountMinor).toBe(80_000);
    expect(shares.find((s) => s.participantId === "ana")?.computedAmountMinor).toBe(20_000);
  });

  it("splits a total by seats, not by rows", () => {
    const { shares, totalComputedMinor } = computeSplit({
      costMode: "total",
      costAmountMinor: 100_000,
      participants: [
        { ...base, id: "juan", weight: 4 },
        { ...base, id: "ana" },
      ],
    });
    expect(shares.find((s) => s.participantId === "juan")?.computedAmountMinor).toBe(80_000);
    expect(shares.find((s) => s.participantId === "ana")?.computedAmountMinor).toBe(20_000);
    expect(totalComputedMinor).toBe(100_000);
  });

  it("consumes capacity seat by seat", () => {
    const roster = [{ id: "juan", attendance: "in" as const, joinedAt: base.joinedAt, weight: 4 }];
    expect(openSlots(10, roster)).toBe(6);
    // El décimo puesto: 4 de Juan + 5 más = 9; el siguiente entra…
    const nine = [...roster, ...Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, attendance: "in" as const, joinedAt: base.joinedAt }))];
    expect(resolveAttendance({ requested: "in", capacity: 10, participants: nine, existing: null })).toBe("in");
    // …y con el cupo lleno, a la lista de espera.
    const ten = [...nine, { id: "p9", attendance: "in" as const, joinedAt: base.joinedAt }];
    expect(resolveAttendance({ requested: "in", capacity: 10, participants: ten, existing: null })).toBe("waitlisted");
  });
});

describe("when an unclaimed name outlives its purpose", () => {
  const startsAt = new Date("2026-08-10T18:00:00Z");

  it("keeps the name through the event and a week after", () => {
    expect(guestNamePurgeDue(startsAt, new Date("2026-08-15T18:00:00Z"))).toBe(false);
  });

  it("purges after the grace — the name told spots apart before the match", () => {
    expect(guestNamePurgeDue(startsAt, new Date("2026-08-18T18:00:01Z"))).toBe(true);
  });
});
