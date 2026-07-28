import type { Attendance, EventKind } from "./types";

/**
 * Whether somebody who said they are coming actually counts as confirmed.
 *
 * An event can attach conditions — upload proof of payment, tick that you read
 * the instructions — and until they are met the person is on the list but not
 * confirmed. Pure functions over plain data, like the rest of `src/domain`: no
 * ORM, no framework, no clock.
 *
 * The rule this module exists to enforce is one sentence: **a participant is
 * confirmed when every policy on the event has an approved submission from
 * them.** Everything below is the bookkeeping around that sentence.
 */

export type PolicyKind = "proof_of_payment" | "acknowledgement";

export type PolicySubmissionStatus = "submitted" | "approved" | "rejected";

/**
 * A participant's standing on one policy. `missing` is the state with no row
 * behind it — they have not responded at all.
 */
export type PolicyState = "missing" | PolicySubmissionStatus;

export interface Policy {
  id: string;
  kind: PolicyKind;
  /** The organizer's own wording. Rendered verbatim, never translated. */
  label: string;
  /** Optional instructions — where to transfer, what the photo should show. */
  description: string | null;
  position: number;
}

export interface PolicySubmission {
  policyId: string;
  participantId: string;
  status: PolicySubmissionStatus;
}

export interface PolicyStanding {
  policy: Policy;
  state: PolicyState;
}

export interface ParticipantCompliance {
  participantId: string;
  /** Every policy on the event, in order, with this participant's state. */
  standings: PolicyStanding[];
  /** Not yet approved — precisely why this person is not confirmed. */
  blocking: Policy[];
  /** The subset of `blocking` already sent and waiting on the organizer. */
  awaitingReview: Policy[];
  /** The subset of `blocking` the organizer turned down. */
  rejected: Policy[];
  /** True when nothing is blocking. Vacuously true on an event with no policies. */
  compliant: boolean;
}

/**
 * Which policies to offer when the organizer picks a kind of event.
 *
 * Suggestions, not rules: every one is added by an explicit tap and can be
 * removed, renamed or replaced. A five-a-side game is the case that motivated
 * the whole feature — somebody fronts the pitch and wants the money before
 * anyone counts as coming — while a kids' party is more likely to care that
 * parents read the address and the allergy note than that they paid.
 */
export const POLICY_SUGGESTIONS: Record<EventKind, PolicyKind[]> = {
  match: ["proof_of_payment"],
  party: ["proof_of_payment", "acknowledgement"],
  kids_party: ["acknowledgement"],
  other: [],
};

/**
 * Whether this kind of policy is settled by the participant alone.
 *
 * Ticking a box is its own proof, so an acknowledgement is approved the moment
 * it is submitted. A payment receipt is a claim about the world that somebody
 * has to look at, which is the whole point of requiring one — if uploading any
 * image confirmed you, the policy would check that a person owns a camera.
 */
export function isSelfApproving(kind: PolicyKind): boolean {
  return kind === "acknowledgement";
}

/** The status a fresh submission gets, given who decides it. */
export function initialSubmissionStatus(kind: PolicyKind): PolicySubmissionStatus {
  return isSelfApproving(kind) ? "approved" : "submitted";
}

/**
 * Whether a participant is subject to policies at all.
 *
 * Only people who said they are coming. Somebody who answered "out" has nothing
 * to prove, and putting a waitlisted person through the hoops would be asking
 * them to pay for a spot they do not have.
 */
export function isSubjectToPolicies(attendance: Attendance): boolean {
  return attendance === "in";
}

function sortPolicies(policies: Policy[]): Policy[] {
  return [...policies].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/**
 * Works out where one participant stands against every policy on the event.
 *
 * A rejected submission blocks exactly like a missing one — the difference is
 * only what the participant is told, since one of them needs "send it again"
 * and the other needs "send it".
 */
export function resolveParticipantCompliance(
  participantId: string,
  policies: Policy[],
  submissions: PolicySubmission[],
): ParticipantCompliance {
  const ordered = sortPolicies(policies);

  const byPolicy = new Map<string, PolicySubmissionStatus>();
  for (const submission of submissions) {
    if (submission.participantId === participantId) {
      byPolicy.set(submission.policyId, submission.status);
    }
  }

  const standings: PolicyStanding[] = ordered.map((policy) => ({
    policy,
    state: byPolicy.get(policy.id) ?? "missing",
  }));

  const blocking = standings.filter((s) => s.state !== "approved").map((s) => s.policy);

  return {
    participantId,
    standings,
    blocking,
    awaitingReview: standings.filter((s) => s.state === "submitted").map((s) => s.policy),
    rejected: standings.filter((s) => s.state === "rejected").map((s) => s.policy),
    compliant: blocking.length === 0,
  };
}

/** The same, for a whole roster. Keyed by participant id. */
export function resolveCompliance(
  participantIds: string[],
  policies: Policy[],
  submissions: PolicySubmission[],
): Map<string, ParticipantCompliance> {
  const result = new Map<string, ParticipantCompliance>();

  for (const participantId of participantIds) {
    result.set(participantId, resolveParticipantCompliance(participantId, policies, submissions));
  }

  return result;
}

/**
 * Splits the people who said they are coming into confirmed and not-yet.
 *
 * Order is preserved from the input, which is join order, so the roster reads
 * the same way it did before policies existed.
 *
 * Note what this does NOT do: it does not change who occupies a spot or who
 * owes money. Somebody who has not sent their receipt is still coming and still
 * owes their share — the policy governs how they are *shown*, not whether they
 * exist. Letting it free their spot would mean the roster silently overbooked
 * every time a payment was slow. See DECISIONS.md.
 */
export function partitionByCompliance<T extends { id: string }>(
  attending: T[],
  compliance: Map<string, ParticipantCompliance>,
): { confirmed: T[]; pending: T[] } {
  const confirmed: T[] = [];
  const pending: T[] = [];

  for (const member of attending) {
    // Absent from the map means no policies applied to them, which is compliant.
    if (compliance.get(member.id)?.compliant ?? true) {
      confirmed.push(member);
    } else {
      pending.push(member);
    }
  }

  return { confirmed, pending };
}

/**
 * How many submissions are sitting in the organizer's queue.
 *
 * Only `submitted` counts. Approved ones are done, rejected ones are back with
 * the participant, and missing ones are nobody's queue.
 */
export function pendingReviewCount(submissions: PolicySubmission[]): number {
  return submissions.filter((submission) => submission.status === "submitted").length;
}
