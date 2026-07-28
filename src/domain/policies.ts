import { findHandler, initialStatusFor, isKnownHandler } from "./policy-handlers";
import type { Attendance } from "./types";

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

export type PolicySubmissionStatus = "submitted" | "approved" | "rejected";

/**
 * A participant's standing on one policy. `missing` is the state with no row
 * behind it — they have not responded at all.
 */
export type PolicyState = "missing" | PolicySubmissionStatus;

export interface Policy {
  id: string;
  /** The catalogue entry this is an instance of. */
  definitionId: string;
  /**
   * The behaviour key from the catalogue. Resolved through
   * `src/domain/policy-handlers.ts`; a value this deploy does not recognise is
   * handled explicitly rather than crashing — see `isSupported`.
   */
  handler: string;
  /**
   * What the participant reads: the organizer's override if they set one, else
   * the catalogue label in the reader's language. Resolved before it gets here.
   */
  label: string;
  /** Instructions — where to transfer, what the photo should show. */
  description: string | null;
  /**
   * What the organizer actually typed, or null when this policy follows the
   * catalogue.
   *
   * Separate from `label` because the two answer different questions: `label`
   * is what to render, and this is what to send back to the edit form. Feeding
   * the resolved label into the form would pin every inherited policy to its
   * current wording the first time anybody saved the event.
   */
  labelOverride: string | null;
  descriptionOverride: string | null;
  position: number;
}

/**
 * Whether this deploy knows how to make somebody satisfy this policy.
 *
 * False only through operator error: a catalogue row naming a handler that
 * does not exist here, which happens if the database is seeded ahead of the
 * code or a deploy is rolled back under it.
 */
export function isSupported(policy: Policy): boolean {
  return isKnownHandler(policy.handler);
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
  /**
   * Policies naming a handler this deploy does not know.
   *
   * Reported so the organizer can be told, and deliberately EXCLUDED from
   * `blocking`. Fail-safe rather than fail-closed: this is roster tidiness,
   * not security, and blocking on a requirement nobody can act on would strand
   * every participant with no way forward. Operator error should be loud, not
   * paralysing.
   */
  unsupported: Policy[];
  /** True when nothing is blocking. Vacuously true on an event with no policies. */
  compliant: boolean;
}

/**
 * Whether the participant settles this policy alone.
 *
 * Delegates to the handler registry rather than deciding here, because "who
 * approves this" is a property of the behaviour, and the behaviour is named by
 * a row in the catalogue. Unknown handlers report false — nothing offers a
 * control for them, so nothing is ever submitted.
 */
export function isSelfApproving(policy: Policy): boolean {
  return findHandler(policy.handler)?.settledBy === "participant";
}

/** The status a fresh submission gets, given who settles it. */
export function initialSubmissionStatus(policy: Policy): PolicySubmissionStatus {
  const handler = findHandler(policy.handler);
  // Unreachable through the UI; "submitted" is the conservative fallback
  // because it puts a human in the loop rather than auto-confirming.
  return handler ? initialStatusFor(handler) : "submitted";
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

  const unsupported = standings.filter((s) => !isSupported(s.policy)).map((s) => s.policy);

  const blocking = standings
    .filter((s) => s.state !== "approved" && isSupported(s.policy))
    .map((s) => s.policy);

  return {
    participantId,
    standings,
    blocking,
    awaitingReview: standings.filter((s) => s.state === "submitted").map((s) => s.policy),
    rejected: standings.filter((s) => s.state === "rejected").map((s) => s.policy),
    unsupported,
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
