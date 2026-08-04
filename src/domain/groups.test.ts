import { describe, expect, it } from "vitest";

import {
  GROUP_NAME_MAX,
  MAX_GROUP_MEMBERS,
  checkGroupName,
  groupJoinState,
  invitableMembers,
  mayInvite,
  nameLength,
  type GroupMemberView,
} from "./groups";

/**
 * The consent gate, tested where it is decided.
 *
 * These rules are what replaced an organizer typing a stranger's address into
 * a box. Getting `mayInvite` wrong in the permissive direction would put this
 * app back to emailing people who never agreed to hear from it — the exact
 * thing the whole feature exists to stop — so the "no" cases matter more here
 * than the "yes" one.
 */

const member = (status: GroupMemberView["status"], userId = "u1"): GroupMemberView => ({
  userId,
  displayName: "Alguien",
  avatarUrl: null,
  status,
});

describe("who may be invited", () => {
  it("lets through somebody who joined", () => {
    expect(mayInvite(member("joined"))).toBe(true);
  });

  it("refuses somebody who declined", () => {
    expect(mayInvite(member("declined"))).toBe(false);
  });

  it("refuses somebody who was never asked", () => {
    // The dangerous direction: absence of a row must never read as consent.
    expect(mayInvite(undefined)).toBe(false);
    expect(mayInvite(null)).toBe(false);
  });

  it("filters a mixed list down to the people who said yes", () => {
    const list = [
      member("joined", "a"),
      member("declined", "b"),
      member("joined", "c"),
    ];

    expect(invitableMembers(list).map((m) => m.userId)).toEqual(["a", "c"]);
  });
});

describe("what the join link says", () => {
  it("asks somebody who has never answered", () => {
    expect(groupJoinState({ isOwner: false, membership: null, joinedCount: 3 })).toBe("asking");
  });

  it("tells a member they are already in", () => {
    expect(groupJoinState({ isOwner: false, membership: "joined", joinedCount: 3 })).toBe("joined");
  });

  it("lets somebody who declined change their mind", () => {
    expect(groupJoinState({ isOwner: false, membership: "declined", joinedCount: 3 })).toBe(
      "declined",
    );
  });

  it("has nothing to offer the owner", () => {
    expect(groupJoinState({ isOwner: true, membership: null, joinedCount: 3 })).toBe("owner");
  });

  it("says so when the group is full", () => {
    expect(
      groupJoinState({ isOwner: false, membership: null, joinedCount: MAX_GROUP_MEMBERS }),
    ).toBe("full");
  });

  /**
   * The cap must not lock somebody out of a membership they already hold, nor
   * out of one they are re-entering: they were counted in that total.
   */
  it("never locks an existing or returning member out with the cap", () => {
    expect(
      groupJoinState({ isOwner: false, membership: "joined", joinedCount: MAX_GROUP_MEMBERS }),
    ).toBe("joined");
    expect(
      groupJoinState({ isOwner: false, membership: "declined", joinedCount: MAX_GROUP_MEMBERS }),
    ).toBe("declined");
  });
});

describe("naming a group", () => {
  it("takes an ordinary name", () => {
    expect(checkGroupName("Fútbol de los jueves")).toEqual({
      ok: true,
      value: "Fútbol de los jueves",
    });
  });

  it("trims what was typed", () => {
    expect(checkGroupName("  La familia  ").value).toBe("La familia");
  });

  it("rejects a blank name", () => {
    expect(checkGroupName("").problem).toBe("empty");
    expect(checkGroupName("   ").problem).toBe("empty");
  });

  it("accepts exactly the limit and refuses one past it", () => {
    expect(checkGroupName("a".repeat(GROUP_NAME_MAX)).ok).toBe(true);
    expect(checkGroupName("a".repeat(GROUP_NAME_MAX + 1)).problem).toBe("too-long");
  });

  it("counts an emoji as one character, the way a reader sees it", () => {
    // ⚽ is inside the BMP; 🎂 is not. Only the second proves the point.
    expect(nameLength("🎂")).toBe(1);
    expect("🎂".length).toBe(2);
    expect(checkGroupName("🎂".repeat(GROUP_NAME_MAX)).ok).toBe(true);
  });
});
