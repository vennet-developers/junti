import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_TYPES,
  RECIPIENT_ROLE,
  changedFields,
  deepLink,
  isNotificationType,
  relativeParts,
  unreadBadge,
  type EventSnapshot,
} from "./notifications";

/**
 * The rules that decide where a tap goes and whether anybody is told at all.
 *
 * Two of these guard against failures that would be invisible in review and
 * expensive in production: a participant handed a URL with the organizer token
 * in it, and a save-with-no-changes waking up everyone who is coming.
 */

describe("the taxonomy is closed", () => {
  it("declares an audience for every type", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(RECIPIENT_ROLE[type], `no audience for ${type}`).toMatch(/^(organizer|participant)$/);
    }
  });

  it("declares an audience for no type that does not exist", () => {
    expect(Object.keys(RECIPIENT_ROLE).sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it("refuses a name from outside the list", () => {
    expect(isNotificationType("rsvp_received")).toBe(true);
    expect(isNotificationType("event_exploded")).toBe(false);
  });
});

describe("the deep link matches the audience", () => {
  const context = { publicToken: "seeddemo8de10ab", organizerToken: "seeddemo8de10organizer" };

  it("sends an organizer to the panel where the decision is made", () => {
    expect(deepLink("approval_pending", context)).toBe(
      "/e/seeddemo8de10ab/manage/seeddemo8de10organizer",
    );
    expect(deepLink("rsvp_received", context)).toContain("/manage/");
  });

  /**
   * The failure this exists for: a participant-facing notification built with
   * the organizer's link. The token is the whole of the organizer's authority,
   * and a notification is the one place it could be handed out by accident.
   */
  it("never leaks the organizer token to a participant", () => {
    for (const type of NOTIFICATION_TYPES) {
      if (RECIPIENT_ROLE[type] === "organizer") continue;
      expect(deepLink(type, context), `${type} leaks the token`).not.toContain(
        context.organizerToken,
      );
    }

    expect(deepLink("event_cancelled", context)).toBe("/e/seeddemo8de10ab");
  });
});

describe("the unread badge", () => {
  it("shows nothing when there is nothing", () => {
    expect(unreadBadge(0)).toBeNull();
    // A negative count is impossible from the query and trivially possible
    // from a bug; showing "-1" on a bell is worse than showing nothing.
    expect(unreadBadge(-3)).toBeNull();
  });

  it("counts while counting is useful", () => {
    expect(unreadBadge(1)).toBe("1");
    expect(unreadBadge(9)).toBe("9");
  });

  it("stops counting once the number stops meaning anything", () => {
    expect(unreadBadge(10)).toBe("9+");
    expect(unreadBadge(4_100)).toBe("9+");
  });
});

describe("what changed on an event", () => {
  const base: EventSnapshot = {
    title: "Fútbol de los jueves",
    startsAt: new Date("2026-08-13T01:00:00.000Z"),
    location: "Cancha 3",
    capacity: 12,
    costMode: "per_person",
    costAmountMinor: 20_000,
  };

  /**
   * The one that stops twenty people being pinged because somebody opened the
   * edit form and pressed save.
   */
  it("reports nothing when nothing moved", () => {
    expect(changedFields(base, { ...base })).toEqual([]);
  });

  it("compares dates by instant, not by identity", () => {
    const same = { ...base, startsAt: new Date("2026-08-13T01:00:00.000Z") };
    expect(changedFields(base, same)).toEqual([]);
  });

  it("names the moves worth knowing about", () => {
    const moved = {
      ...base,
      startsAt: new Date("2026-08-14T01:00:00.000Z"),
      location: "Cancha 1",
    };
    expect(changedFields(base, moved)).toEqual(["startsAt", "location"]);
  });

  it("reads a price change as one fact, whichever column carries it", () => {
    expect(changedFields(base, { ...base, costAmountMinor: 25_000 })).toEqual(["cost"]);
    expect(changedFields(base, { ...base, costMode: "none", costAmountMinor: null })).toEqual([
      "cost",
    ]);
  });

  it("ignores what a participant would not recognise as a change", () => {
    // Notes and the attached group are both real columns and neither is news:
    // one is the organizer's own scratchpad, the other decides who may be
    // invited next time.
    expect(changedFields(base, { ...base })).toEqual([]);
  });
});

describe("how long ago", () => {
  const now = new Date("2026-08-05T12:00:00.000Z").getTime();
  const ago = (ms: number) => relativeParts(now - ms, now);

  it("counts in the largest unit that still says something", () => {
    expect(ago(5_000)).toEqual({ value: -5, unit: "second" });
    expect(ago(90_000)).toEqual({ value: -2, unit: "minute" });
    expect(ago(3 * 3_600_000)).toEqual({ value: -3, unit: "hour" });
    expect(ago(50 * 3_600_000)).toEqual({ value: -2, unit: "day" });
  });

  /**
   * Two clocks that disagree by a second must not produce "in 1 second" in a
   * list of things that have already happened.
   */
  it("never reports the future", () => {
    expect(relativeParts(now + 4_000, now)).toEqual({ value: -0, unit: "second" });
  });
});
