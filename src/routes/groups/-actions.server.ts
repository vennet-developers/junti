import "@/server/assert-server";

import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { db } from "@/db/client";
import { groupMembers, groups } from "@/db/schema";
import { GROUP_NAME_MAX, MAX_GROUP_MEMBERS, checkGroupName, groupJoinState } from "@/domain/groups";
import { resolvePreferences } from "@/lib/preferences";
import { getOrganizer } from "@/lib/organizer";
import { createGroupToken } from "@/lib/tokens";
import { track } from "@/lib/analytics";

/**
 * Group mutations: making one, deleting one, and answering somebody's link.
 *
 * Every one of these is scoped by the signed-in account rather than by a
 * token, which is the difference between a group and an event. An event's
 * manage link can be handed to a co-organizer because running the day is
 * delegable; a group is a list of people who consented to *you*, and there is
 * nothing there to delegate.
 *
 * The asymmetry between the two sides is deliberate and worth naming. The
 * owner may create and delete; only the member may join or leave. There is no
 * "add member" and no "remove member" anywhere in this file, and their absence
 * is the feature — a group nobody can be put into is a group whose every row
 * is somebody's own decision.
 */

export type GroupState = { errors: Record<string, string>; ok?: boolean };

const denied = (message: string): GroupState => ({ errors: { _form: message } });

/**
 * Creates a group owned by the signed-in account.
 *
 * The join token is minted here and never changes. Rotating it was tempting —
 * it would let an owner cut off a link that got forwarded somewhere unwanted —
 * but a group is capped at fifty and every join is a person deciding, so the
 * damage a leaked link can do is bounded by people saying yes. A rotate button
 * is a fine thing to add the day that stops being true.
 */
export async function createGroup(formData: FormData): Promise<GroupState> {
  const organizer = await getOrganizer();
  const { copy } = await resolvePreferences();

  if (!organizer) return denied(copy.errors.notFound);

  const checked = checkGroupName(String(formData.get("name") ?? ""));

  if (!checked.ok || !checked.value) {
    return {
      errors: {
        name:
          checked.problem === "too-long"
            ? copy.groups.errorNameTooLong(GROUP_NAME_MAX)
            : copy.groups.errorNameEmpty,
      },
    };
  }

  const groupId = uuidv7();

  await db.insert(groups).values({
    id: groupId,
    ownerId: organizer.id,
    name: checked.value,
    joinToken: createGroupToken(),
  });

  track("group_created", { group_id: groupId }, organizer.id);

  return { errors: {}, ok: true };
}

/**
 * Deletes a group and, by cascade, its memberships.
 *
 * Events that pointed at it keep existing — `events.group_id` is
 * `ON DELETE SET NULL` — and lose the ability to invite from here. That is the
 * right shape: an event is a thing that happened, and deleting the address
 * book should never delete the party.
 */
export async function deleteGroup(groupId: string): Promise<GroupState> {
  const organizer = await getOrganizer();
  const { copy } = await resolvePreferences();

  if (!organizer) return denied(copy.errors.notFound);

  const id = z.uuid().safeParse(groupId);
  if (!id.success) return denied(copy.errors.notFound);

  // Ownership is in the WHERE clause rather than in a prior read: an id
  // belonging to somebody else's group deletes nothing, with no second query
  // and no window between the check and the delete.
  await db.delete(groups).where(and(eq(groups.id, id.data), eq(groups.ownerId, organizer.id)));

  return { errors: {}, ok: true };
}

/**
 * Records this reader's answer to a group's link: yes or no.
 *
 * Both answers are written. A "no" is not the absence of a row — it is a row
 * that says no, which is what lets the owner see they were asked and declined
 * rather than wondering whether the link ever arrived. And because it is a row
 * rather than a deletion, changing your mind later is an update, not a
 * resurrection.
 *
 * The cap is enforced here against a live count. Two people accepting the
 * fiftieth spot at once can both land, and that is fine: the limit exists to
 * stop a list of hundreds, not to be exact at the boundary.
 */
export async function answerGroup(
  joinToken: string,
  answer: "joined" | "declined",
): Promise<GroupState> {
  const organizer = await getOrganizer();
  const { copy } = await resolvePreferences();

  if (!organizer) return denied(copy.groups.joinSignInHelp);

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.joinToken, joinToken))
    .limit(1);

  if (!group) return denied(copy.groups.stateNotFound);

  // An owner is already the group; there is nothing for them to accept.
  if (group.ownerId === organizer.id) return denied(copy.groups.stateOwner);

  const { countJoined, findMembership, setMembership } = await import("@/lib/groups");

  const membership = await findMembership(group.id, organizer.id);
  const joinedCount = await countJoined(group.id);

  // Re-checked server-side rather than trusted from the page that rendered the
  // button: the group may have filled up while somebody had the link open.
  const state = groupJoinState({ isOwner: false, membership, joinedCount });
  if (answer === "joined" && state === "full") {
    return denied(copy.groups.stateFullHelp(MAX_GROUP_MEMBERS));
  }

  await setMembership({
    id: uuidv7(),
    groupId: group.id,
    userId: organizer.id,
    status: answer,
  });

  // The decline is the number that matters here: if most people say no, the
  // consent model is friction rather than a feature, and that is worth
  // knowing early. See ANALYTICS.md.
  track("group_answered", { group_id: group.id, answer }, organizer.id);

  return { errors: {}, ok: true };
}

/**
 * Leaving a group, from the member's side.
 *
 * A "declined" row rather than a delete, for the same reason answering no
 * writes one: the owner should see that somebody left rather than watch a name
 * silently vanish, and the person should be able to come back without needing
 * the link again.
 */
export async function leaveGroup(groupId: string): Promise<GroupState> {
  const organizer = await getOrganizer();
  const { copy } = await resolvePreferences();

  if (!organizer) return denied(copy.errors.notFound);

  const id = z.uuid().safeParse(groupId);
  if (!id.success) return denied(copy.errors.notFound);

  await db
    .update(groupMembers)
    .set({ status: "declined", updatedAt: new Date() })
    .where(and(eq(groupMembers.groupId, id.data), eq(groupMembers.userId, organizer.id)));

  track("group_left", { group_id: id.data }, organizer.id);

  return { errors: {}, ok: true };
}
