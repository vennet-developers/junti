import type { GroupMembership } from "@/db/schema";

/**
 * Who may be invited to what, and by whom.
 *
 * Pure functions over plain data — no framework, no database. These are the
 * rules that replaced an organizer typing an address into a box, so they are
 * worth stating in one place where they can be read and tested rather than
 * inferred from three query builders.
 *
 * The one idea underneath all of them: **an invitation is only legitimate if
 * the person being invited has already said yes, to this organizer, by their
 * own act.** Everything here is a consequence of that sentence.
 */

/**
 * A group holds at most this many people.
 *
 * Not a technical limit — Postgres would not notice a thousand. It is an
 * anti-abuse limit: the whole feature exists so that inviting people is easy,
 * and "easy to invite a hundred strangers" is the failure mode it was designed
 * to prevent. Fifty is well past a football team, a family or a dinner, which
 * are the cases this is for. A real group that outgrows it is a signal worth
 * reading, not a number to quietly raise.
 */
export const MAX_GROUP_MEMBERS = 50;

/** Long enough to name "Fútbol de los jueves", short enough to fit a chip. */
export const GROUP_NAME_MAX = 40;

export interface GroupMemberView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: GroupMembership;
}

/**
 * Whether this organizer may invite this person to an event.
 *
 * The single gate every invitation passes through. A "joined" membership is
 * the only thing that opens it: never asked and explicitly declined both mean
 * no, and they mean no for the same reason — nobody said yes.
 */
export function mayInvite(member: { status: GroupMembership } | undefined | null): boolean {
  return member?.status === "joined";
}

/** The members an event may actually be sent to, in one place. */
export function invitableMembers(members: readonly GroupMemberView[]): GroupMemberView[] {
  return members.filter((member) => mayInvite(member));
}

export type GroupJoinState =
  /** Never answered. The link is asking them for the first time. */
  | "asking"
  /** Already in. Opening the link again just says so. */
  | "joined"
  /** Said no, or left. The link asks again — a change of mind is allowed. */
  | "declined"
  /** Their own group. There is nothing to accept. */
  | "owner"
  /** At the cap, and this person is not already a member. */
  | "full";

/**
 * What the join link should show this reader.
 *
 * The cap is checked here rather than at the button, because a group that
 * filled up while somebody had the link open should tell them so instead of
 * failing on submit — and because an existing member must never be locked out
 * of their own membership by a cap they are already inside.
 */
export function groupJoinState(input: {
  isOwner: boolean;
  membership: GroupMembership | null;
  joinedCount: number;
}): GroupJoinState {
  if (input.isOwner) return "owner";
  if (input.membership === "joined") return "joined";

  // A returning "declined" may always change their mind, cap or no cap: they
  // are re-entering a group they were once counted in.
  if (input.membership === "declined") return "declined";

  return input.joinedCount >= MAX_GROUP_MEMBERS ? "full" : "asking";
}

export type GroupNameProblem = "empty" | "too-long";

export interface GroupNameCheck {
  ok: boolean;
  problem?: GroupNameProblem;
  /** Trimmed, ready to store. Only when `ok`. */
  value?: string;
}

/** Counts what a reader sees, so an emoji-laden name is measured fairly. */
export function nameLength(name: string): number {
  return Array.from(name).length;
}

export function checkGroupName(raw: string): GroupNameCheck {
  const name = raw.trim();

  if (name.length === 0) return { ok: false, problem: "empty" };
  if (nameLength(name) > GROUP_NAME_MAX) return { ok: false, problem: "too-long" };

  return { ok: true, value: name };
}
