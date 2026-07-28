/**
 * What a policy actually *does*, keyed by the `handler` column of
 * `policy_definitions`.
 *
 * **This is the seam between an open set and a closed one.** The catalogue in
 * the database decides which policies exist, what they are called, and which
 * kinds of event offer them — all of that is data, and adding to it is an
 * INSERT. What a policy *does* cannot be data: a row cannot ship a file input,
 * a canvas resizer, a byte sniffer and a review screen. So the row names a
 * behaviour and this registry supplies it.
 *
 * The practical consequence, and the reason the split is worth it:
 *
 * - **A new policy that behaves like an existing one is one row.**
 *   "Comprobante de inscripción" is another `file_upload_reviewed`. No deploy.
 * - **A new *kind* of behaviour is code.** A signature pad, a QR check-in, a
 *   payment link — each needs an implementation here, a control in
 *   `src/components/policy-controls`, and a branch in the submission action.
 *
 * Three things have to agree for a handler to work, which is exactly why the
 * key lives in the database instead of the behaviour living in a component:
 * the control the participant sees, what the server accepts, and who settles
 * it. If the component were the source of truth, the server would have to
 * trust the client about what to validate — which for a payment gate it
 * cannot.
 *
 * Pure data and pure functions, like the rest of `src/domain`: no React, no
 * ORM, no clock.
 */

import type { PolicySubmissionStatus } from "./policies";

/** Who decides that the requirement has been met. */
export type SettledBy =
  /** Doing it IS meeting it — ticking a box is its own proof. */
  | "participant"
  /** A human has to look at what was sent. */
  | "organizer";

/** What a submission must carry. */
export type EvidenceKind = "none" | "image";

export interface PolicyHandler {
  key: string;
  settledBy: SettledBy;
  evidence: EvidenceKind;
}

/**
 * Every behaviour this deploy understands.
 *
 * Keys are stable strings stored in the database. **Renaming one is a data
 * migration**, not a refactor — the old key is in rows that are already live.
 */
export const POLICY_HANDLERS: Record<string, PolicyHandler> = {
  /**
   * Upload an image, then wait for the organizer to approve it.
   *
   * The waiting is the point. If uploading confirmed you, the requirement
   * would be checking that people own cameras.
   */
  file_upload_reviewed: {
    key: "file_upload_reviewed",
    settledBy: "organizer",
    evidence: "image",
  },

  /**
   * Tick a box. Settled on submission, because there is nothing for anyone
   * else to judge.
   */
  self_acknowledged: {
    key: "self_acknowledged",
    settledBy: "participant",
    evidence: "none",
  },
};

/** The handler for a key, or null when this deploy does not know it. */
export function findHandler(key: string): PolicyHandler | null {
  return POLICY_HANDLERS[key] ?? null;
}

export function isKnownHandler(key: string): boolean {
  return findHandler(key) !== null;
}

/**
 * The status a fresh submission gets, given who settles it.
 *
 * Unknown handlers never reach here — nothing offers a control for them, so
 * there is no submission to status.
 */
export function initialStatusFor(handler: PolicyHandler): PolicySubmissionStatus {
  return handler.settledBy === "participant" ? "approved" : "submitted";
}
