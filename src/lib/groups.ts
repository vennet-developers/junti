import "@/server/assert-server";

import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { events, groupMembers, groups, userProfiles } from "@/db/schema";
import type { GroupMembership } from "@/db/schema";
import { MAX_GROUP_MEMBERS, type GroupMemberView } from "@/domain/groups";

/**
 * Reading and writing groups.
 *
 * Names come from `user_profiles` on every read rather than being copied into
 * the membership row: somebody who fixes their name in their profile fixes it
 * in every group at once, and a group that stored a snapshot would keep
 * calling them whatever they were called the day they joined.
 *
 * Nothing here returns an email. The organizer's screens need to know WHO is
 * in a group, and a name and a photo answer that — an address would only be
 * something to leak.
 */

export interface GroupSummary {
  id: string;
  name: string;
  joinToken: string;
  /** People who said yes. Declined rows are members of nothing. */
  memberCount: number;
  createdAt: Date;
}

export interface GroupDetail extends GroupSummary {
  ownerId: string;
  members: GroupMemberView[];
}

/** The groups this person owns, newest first. */
export async function loadOwnedGroups(ownerId: string): Promise<GroupSummary[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      joinToken: groups.joinToken,
      createdAt: groups.createdAt,
      memberCount: count(groupMembers.id),
    })
    .from(groups)
    .leftJoin(
      groupMembers,
      and(eq(groupMembers.groupId, groups.id), eq(groupMembers.status, "joined")),
    )
    .where(eq(groups.ownerId, ownerId))
    .groupBy(groups.id)
    .orderBy(desc(groups.createdAt));

  return rows;
}

/** One group with its people, for the owner's management screen. */
export async function loadGroupDetail(groupId: string, ownerId: string): Promise<GroupDetail | null> {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.ownerId, ownerId)))
    .limit(1);

  if (!group) return null;

  const members = await loadGroupMembers(groupId);

  return {
    id: group.id,
    name: group.name,
    joinToken: group.joinToken,
    ownerId: group.ownerId,
    createdAt: group.createdAt,
    memberCount: members.filter((member) => member.status === "joined").length,
    members,
  };
}

/**
 * Everyone who has answered this group's link, joined and declined alike.
 *
 * Declined rows are returned rather than filtered so the owner can see that
 * somebody was asked and said no — which is the difference between "I forgot
 * to invite Ana" and "Ana does not want to be here", and only one of those is
 * worth acting on.
 */
export async function loadGroupMembers(groupId: string): Promise<GroupMemberView[]> {
  const rows = await db
    .select({
      userId: groupMembers.userId,
      status: groupMembers.status,
      displayName: userProfiles.fullName,
    })
    .from(groupMembers)
    .leftJoin(userProfiles, eq(userProfiles.userId, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(desc(groupMembers.createdAt));

  return rows.map((row) => ({
    userId: row.userId,
    // A member with no profile row is somebody who signed in and never
    // finished onboarding. They are still a member; they just have no name yet.
    displayName: row.displayName ?? "—",
    /*
      Always initials here. Profiles store no photo — the avatar on a roster
      comes from the participant row the identity provider filled in — and
      `PersonAvatar` colours initials from the name, so a group list reads as
      people rather than as a column of grey discs anyway.
    */
    avatarUrl: null,
    status: row.status,
  }));
}

/** A group by its join link, for the page that asks somebody to join. */
export async function findGroupByJoinToken(joinToken: string) {
  const [group] = await db.select().from(groups).where(eq(groups.joinToken, joinToken)).limit(1);
  return group ?? null;
}

/** This reader's answer to this group, or null if they have never answered. */
export async function findMembership(
  groupId: string,
  userId: string,
): Promise<GroupMembership | null> {
  const [row] = await db
    .select({ status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  return row?.status ?? null;
}

/** How many people currently say yes — the number the cap is checked against. */
export async function countJoined(groupId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "joined")));

  return row?.total ?? 0;
}

/**
 * Records an answer to a group's invitation.
 *
 * Upsert, because answering twice is a change of mind rather than a second
 * membership — and because "I left, then came back" has to be expressible.
 * The cap is enforced by the caller, which knows whether this person was
 * already counted inside it.
 */
export async function setMembership(input: {
  id: string;
  groupId: string;
  userId: string;
  status: GroupMembership;
}): Promise<void> {
  await db
    .insert(groupMembers)
    .values({
      id: input.id,
      groupId: input.groupId,
      userId: input.userId,
      status: input.status,
    })
    .onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.userId],
      set: { status: input.status, updatedAt: new Date() },
    });
}

/** The group an event invites from, with its people. Null for a one-off. */
export async function loadEventGroup(eventId: string): Promise<GroupDetail | null> {
  const [row] = await db
    .select({ groupId: events.groupId, ownerId: events.organizerId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!row?.groupId) return null;

  return loadGroupDetail(row.groupId, row.ownerId);
}

/** Groups an organizer may attach to an event: their own, with people in them. */
export async function loadAttachableGroups(ownerId: string): Promise<GroupSummary[]> {
  return loadOwnedGroups(ownerId);
}

export { MAX_GROUP_MEMBERS };
