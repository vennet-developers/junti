import { describe, expect, it } from "vitest";

import type { RosterView } from "@/lib/roster";

import { toParticipantView } from "./roster-projection";

/**
 * The role boundary, asserted rather than reviewed.
 *
 * This is the only test in the project that exists to stop a FUTURE field from
 * leaking. The card asks that organizer-only affordances be "absent for
 * participants, not merely hidden", and the failure it guards against has
 * already happened once: the participant page spread the whole roster view into
 * its payload, and `pendingReview`, `promotable`, `discrepancies` and an
 * account id per member went with it — invisible on the page and in plain text
 * in the HTML, including for a signed-out reader holding the link.
 *
 * Nothing renders those fields on that surface, which is exactly why nobody
 * noticed. A type alone would not have caught it either: the old code reached
 * the payload through a cast, and a cast is how a type stops being a boundary.
 * So the assertion here is deliberately about the SHAPE of the result and not
 * about any particular field — a new organizer-only key on `RosterView` fails
 * this test until somebody decides, in writing, which side it belongs on.
 */

/** The keys a participant is allowed to receive. Changing this is the decision. */
const ALLOWED_KEYS = [
  "event",
  "policies",
  "members",
  "attending",
  "confirmed",
  "pendingPolicy",
  "notAttending",
  "maybe",
  "waitlisted",
  "collectedMinor",
  "outstandingMinor",
  "totalComputedMinor",
  "openSlots",
].sort();

function member(id: string, name: string) {
  return {
    id,
    displayName: name,
    attendance: "in" as const,
    joinedAt: new Date("2026-08-01T00:00:00.000Z"),
    share: {
      owes: true,
      status: "pending" as const,
      effectiveAmountMinor: 20_000,
      computedAmountMinor: 20_000,
    },
    guests: [{ id: "g1", name: "Invitado de Ana", claimToken: "tok-secret" }],
    // The field this projection exists for.
    userId: "019fcb66-af8d-781e-94b9-0c24104dae10",
    avatarUrl: null,
  };
}

function fullView(): RosterView {
  const ana = member("p1", "Ana Torres");
  const juan = member("p2", "Juan Pablo");

  return {
    event: { id: "e1", title: "Fútbol de los viernes", currency: "COP", hasCost: true },
    members: [ana, juan],
    attending: [ana, juan],
    confirmed: [ana],
    pendingPolicy: [juan],
    notAttending: [],
    maybe: [],
    waitlisted: [],
    policies: [],
    compliance: new Map([["p2", { blocking: [], awaitingReview: [] }]]),
    pendingReview: 3,
    collectedMinor: 20_000,
    outstandingMinor: 20_000,
    totalComputedMinor: 40_000,
    discrepancies: [{ participantId: "p2", differenceMinor: -5_000 }],
    openSlots: 8,
    promotable: 2,
  } as unknown as RosterView;
}

/** The reader every test below assumes unless it says otherwise. */
const SIGNED_IN = { signedIn: true };

describe("what a participant is allowed to receive", () => {
  it("hands over exactly the agreed keys and no others", () => {
    expect(Object.keys(toParticipantView(fullView(), SIGNED_IN)).sort()).toEqual(ALLOWED_KEYS);
  });

  /**
   * Named individually as well as by shape, because these four are the ones
   * that actually shipped and a regression in any of them is a repeat rather
   * than a new mistake.
   */
  it("drops the four fields only the organizer console renders", () => {
    const view = toParticipantView(fullView(), SIGNED_IN) as Record<string, unknown>;

    for (const key of ["pendingReview", "promotable", "discrepancies", "compliance"]) {
      expect(view[key], `${key} is still crossing the wire`).toBeUndefined();
    }
  });

  it("strips claim tokens from guests — a token in the roster is a seat anyone could take", () => {
    const view = toParticipantView(fullView(), SIGNED_IN);
    for (const person of view.members) {
      for (const guest of person.guests) {
        expect(guest).not.toHaveProperty("claimToken");
      }
    }
  });

  it("strips the account id from every list a member can appear in", () => {
    const view = toParticipantView(fullView(), SIGNED_IN);

    const lists = [
      view.members,
      view.attending,
      view.confirmed,
      view.pendingPolicy,
      view.notAttending,
      view.maybe,
      view.waitlisted,
    ];

    for (const list of lists) {
      for (const person of list) {
        expect(person).not.toHaveProperty("userId");
      }
    }
  });

  /**
   * The seven lists are overlapping views of the same people, and the loader's
   * serialiser only writes a shared object once. Mapping each list separately
   * produces a distinct object per list, so one person is written out three or
   * four times — the first version of this projection did exactly that and grew
   * an eight-person payload by 1.6 KB while removing four fields.
   */
  it("gives every list the same objects, so the payload does not multiply", () => {
    const view = toParticipantView(fullView(), SIGNED_IN);
    const ana = view.members.find((person) => person.id === "p1");

    expect(view.attending.find((person) => person.id === "p1")).toBe(ana);
    expect(view.confirmed.find((person) => person.id === "p1")).toBe(ana);
  });

  /**
   * The counterweight. A projection that drops too much is a broken page, and
   * "the roster went blank" is a worse bug than the one this fixes.
   */
  it("keeps what the participant page actually renders", () => {
    const view = toParticipantView(fullView(), SIGNED_IN);

    expect(view.members).toHaveLength(2);
    expect(view.confirmed[0]?.displayName).toBe("Ana Torres");
    expect(view.pendingPolicy[0]?.displayName).toBe("Juan Pablo");
    // The money is shared between the two roles on purpose: everybody splitting
    // a cancha can see the pot. What nobody but the organizer sees is who paid
    // an amount that does not match — that is `discrepancies`, dropped above.
    expect(view.collectedMinor).toBe(20_000);
    expect(view.outstandingMinor).toBe(20_000);
    expect(view.totalComputedMinor).toBe(40_000);
    expect(view.openSlots).toBe(8);
    // Their own share survives; it is what the row shows next to their name.
    expect(view.members[0]?.share?.effectiveAmountMinor).toBe(20_000);
  });
});

/**
 * The second axis, added after the stranger preview showed an organizer what a
 * forwarded link actually reveals: "Recaudado $ 0 · Falta $ 80.000", legible
 * through the sign-in card, to somebody who has not said who they are.
 */
describe("what somebody with no session receives", () => {
  const SIGNED_OUT = { signedIn: false };

  it("sends no totals at all", () => {
    const view = toParticipantView(fullView(), SIGNED_OUT);

    expect(view.collectedMinor).toBeNull();
    expect(view.outstandingMinor).toBeNull();
    expect(view.totalComputedMinor).toBeNull();
  });

  /**
   * The finer-grained half of the same leak. Hiding the summary while every
   * row still carries "$ 20.000 · Debe" would move the number rather than
   * remove it.
   */
  it("sends no per-person amount either, in any list", () => {
    const view = toParticipantView(fullView(), SIGNED_OUT);

    for (const list of [view.members, view.attending, view.confirmed, view.waitlisted]) {
      for (const person of list) {
        expect(person.share, `${person.displayName} still carries a share`).toBeNull();
      }
    }
  });

  /**
   * The counterweight, and the reason this stops at the money: the names are
   * the hook. Seeing that four friends are already in is what makes somebody
   * sign in, so a projection that took the roster too would be worse than the
   * leak it fixed.
   */
  it("keeps the roster, which is the whole reason to open the link", () => {
    const view = toParticipantView(fullView(), SIGNED_OUT);

    expect(view.members).toHaveLength(2);
    expect(view.confirmed[0]?.displayName).toBe("Ana Torres");
    expect(view.openSlots).toBe(8);
  });

  it("still shares one object per person across the lists", () => {
    const view = toParticipantView(fullView(), SIGNED_OUT);
    const ana = view.members.find((person) => person.id === "p1");

    expect(view.attending.find((person) => person.id === "p1")).toBe(ana);
    expect(view.confirmed.find((person) => person.id === "p1")).toBe(ana);
  });
});
