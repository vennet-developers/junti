import { describe, expect, it } from "vitest";

import type { Attendance } from "./types";
import {
  countAttending,
  isFull,
  openSlots,
  promotableCount,
  resolveAttendance,
  type WaitlistParticipant,
} from "./waitlist";

const T0 = new Date("2026-03-01T18:00:00.000Z").getTime();

function participant(
  id: string,
  minutesAfter: number,
  attendance: Attendance = "in",
): WaitlistParticipant {
  return { id, joinedAt: new Date(T0 + minutesAfter * 60_000), attendance };
}

/** Builds a roster from `[id, attendance]` pairs, one minute apart in order. */
function roster(entries: [string, Attendance][]): WaitlistParticipant[] {
  return entries.map(([id, attendance], index) => participant(id, index, attendance));
}

describe("countAttending", () => {
  it("counts only in", () => {
    const people = roster([
      ["a", "in"],
      ["b", "out"],
      ["c", "maybe"],
      ["d", "waitlisted"],
      ["e", "in"],
    ]);
    expect(countAttending(people)).toBe(2);
  });

  it("is zero for an empty roster", () => {
    expect(countAttending([])).toBe(0);
  });
});

describe("openSlots", () => {
  it("returns null for unlimited capacity", () => {
    expect(openSlots(null, roster([["a", "in"]]))).toBeNull();
  });

  it("counts the free slots", () => {
    const people = roster([
      ["a", "in"],
      ["b", "in"],
      ["c", "out"],
    ]);
    expect(openSlots(10, people)).toBe(8);
  });

  it("never goes negative when capacity is lowered below the current roster", () => {
    const people = roster([
      ["a", "in"],
      ["b", "in"],
      ["c", "in"],
      ["d", "in"],
      ["e", "in"],
    ]);
    expect(openSlots(2, people)).toBe(0);
  });

  it("treats a capacity of zero as always full", () => {
    expect(openSlots(0, [])).toBe(0);
    expect(isFull(0, [])).toBe(true);
  });
});

describe("isFull", () => {
  it("is never full with unlimited capacity", () => {
    const many = Array.from({ length: 500 }, (_, i) => participant(`p${i}`, i));
    expect(isFull(null, many)).toBe(false);
  });

  it("is full at exactly capacity", () => {
    const people = roster([
      ["a", "in"],
      ["b", "in"],
    ]);
    expect(isFull(2, people)).toBe(true);
    expect(isFull(3, people)).toBe(false);
  });

  it("does not count out, maybe or waitlisted towards the cap", () => {
    const people = roster([
      ["a", "in"],
      ["b", "out"],
      ["c", "maybe"],
      ["d", "waitlisted"],
    ]);
    expect(isFull(2, people)).toBe(false);
    expect(openSlots(2, people)).toBe(1);
  });
});

describe("waitlist ordering", () => {
  it("orders by join time ascending, earliest first", async () => {
    const { waitlistOrder } = await import("./waitlist");
    const people = [
      participant("late", 30, "waitlisted"),
      participant("first", 5, "waitlisted"),
      participant("middle", 12, "waitlisted"),
      participant("attending", 1, "in"),
    ];

    expect(waitlistOrder(people).map((p) => p.id)).toEqual(["first", "middle", "late"]);
  });

  it("breaks identical join times deterministically by id", async () => {
    const { waitlistOrder } = await import("./waitlist");
    const people = [
      participant("c", 5, "waitlisted"),
      participant("a", 5, "waitlisted"),
      participant("b", 5, "waitlisted"),
    ];

    expect(waitlistOrder(people).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty list when nobody is waiting", async () => {
    const { waitlistOrder } = await import("./waitlist");
    expect(waitlistOrder(roster([["a", "in"]]))).toEqual([]);
  });
});

describe("promotableCount", () => {
  it("is zero when nobody is waiting", () => {
    expect(promotableCount(10, roster([["a", "in"]]))).toBe(0);
  });

  it("is zero when the event is still full", () => {
    const people = roster([
      ["a", "in"],
      ["b", "in"],
      ["c", "waitlisted"],
    ]);
    expect(promotableCount(2, people)).toBe(0);
  });

  it("reports the freed slot after somebody drops out", () => {
    const people = roster([
      ["a", "in"],
      ["b", "out"],
      ["c", "waitlisted"],
    ]);
    expect(promotableCount(2, people)).toBe(1);
  });

  it("is capped by the number of people actually waiting", () => {
    const people = roster([
      ["a", "in"],
      ["b", "waitlisted"],
    ]);
    expect(promotableCount(10, people)).toBe(1);
  });

  it("is capped by the number of free slots", () => {
    const people = roster([
      ["a", "in"],
      ["b", "waitlisted"],
      ["c", "waitlisted"],
      ["d", "waitlisted"],
    ]);
    expect(promotableCount(2, people)).toBe(1);
  });

  it("lets everyone in when the cap is removed", () => {
    const people = roster([
      ["a", "in"],
      ["b", "waitlisted"],
      ["c", "waitlisted"],
    ]);
    expect(promotableCount(null, people)).toBe(2);
  });
});

describe("resolveAttendance", () => {
  const full = roster([
    ["a", "in"],
    ["b", "in"],
  ]);

  it("honours a request to attend when there is room", () => {
    expect(
      resolveAttendance({ requested: "in", capacity: 5, participants: full, existing: null }),
    ).toBe("in");
  });

  it("waitlists a new attendee when the event is full", () => {
    expect(
      resolveAttendance({ requested: "in", capacity: 2, participants: full, existing: null }),
    ).toBe("waitlisted");
  });

  it("never waitlists with unlimited capacity", () => {
    expect(
      resolveAttendance({ requested: "in", capacity: null, participants: full, existing: null }),
    ).toBe("in");
  });

  it("always honours out and maybe, even at capacity", () => {
    expect(
      resolveAttendance({ requested: "out", capacity: 2, participants: full, existing: null }),
    ).toBe("out");
    expect(
      resolveAttendance({ requested: "maybe", capacity: 2, participants: full, existing: null }),
    ).toBe("maybe");
    expect(
      resolveAttendance({ requested: "out", capacity: 0, participants: full, existing: "in" }),
    ).toBe("out");
  });

  it("does not bump someone already attending who re-confirms", () => {
    // 'a' is already one of the two occupying the full event. Re-submitting
    // "I'm in" must not cost them their slot.
    expect(
      resolveAttendance({ requested: "in", capacity: 2, participants: full, existing: "in" }),
    ).toBe("in");
  });

  it("waitlists someone switching from out to in when the event filled up", () => {
    const people = roster([
      ["a", "in"],
      ["b", "in"],
      ["c", "out"],
    ]);
    expect(
      resolveAttendance({ requested: "in", capacity: 2, participants: people, existing: "out" }),
    ).toBe("waitlisted");
  });

  it("lets someone switching from maybe to in take a free slot", () => {
    const people = roster([
      ["a", "in"],
      ["b", "maybe"],
    ]);
    expect(
      resolveAttendance({ requested: "in", capacity: 2, participants: people, existing: "maybe" }),
    ).toBe("in");
  });

  it("keeps someone already waitlisted on the waitlist while the event is full", () => {
    const people = roster([
      ["a", "in"],
      ["b", "in"],
      ["c", "waitlisted"],
    ]);
    expect(
      resolveAttendance({
        requested: "in",
        capacity: 2,
        participants: people,
        existing: "waitlisted",
      }),
    ).toBe("waitlisted");
  });
});

describe("the definition-of-done scenario — capacity 10, an eleventh person", () => {
  it("puts the eleventh person on the waitlist", () => {
    const ten = Array.from({ length: 10 }, (_, i) => participant(`p${i}`, i, "in"));

    expect(isFull(10, ten)).toBe(true);
    expect(openSlots(10, ten)).toBe(0);
    expect(
      resolveAttendance({ requested: "in", capacity: 10, participants: ten, existing: null }),
    ).toBe("waitlisted");
  });

  it("tells the organizer a slot opened once somebody drops out, without promoting", () => {
    const roster11: WaitlistParticipant[] = [
      ...Array.from({ length: 9 }, (_, i) => participant(`p${i}`, i, "in")),
      participant("p9", 9, "out"), // dropped out
      participant("p10", 10, "waitlisted"),
    ];

    expect(openSlots(10, roster11)).toBe(1);
    expect(promotableCount(10, roster11)).toBe(1);
    // Still waitlisted — promotion is the organizer's explicit action.
    expect(roster11.find((p) => p.id === "p10")?.attendance).toBe("waitlisted");
  });
});
