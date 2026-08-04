/**
 * Reading a Postgres unique violation for what it actually means.
 *
 * Two of the roster's unique indexes can fire on the same INSERT and they mean
 * opposite things, so "the insert failed" is not a useful answer on its own:
 *
 * - `participants_event_user_unique` — this account is already on this event.
 *   The row the caller wanted exists. That is a **success**: it is what a
 *   double tap, a second tab, or a retry after a timeout looks like.
 * - `participants_event_name_unique` — somebody else on this roster already
 *   goes by that name. A real collision the person has to resolve.
 *
 * Matched on the constraint name rather than the SQLSTATE, because both are
 * 23505 and the name is the only thing that separates them. Kept out of the
 * `"use server"` module so it can be tested directly: every export from an
 * actions file has to be an async server action.
 */

/** The index that makes joining idempotent per account. */
const SAME_ACCOUNT = "participants_event_user_unique";

/** The index that enforces one display name per event. */
const SAME_NAME = "participants_event_name_unique";

/**
 * True when the insert failed only because this account is already on the
 * roster — in which case the caller already has what it asked for.
 */
export function isAlreadyJoined(error: unknown): boolean {
  return constraintOf(error).includes(SAME_ACCOUNT);
}

/** True when the display name is taken by somebody else on this event. */
export function isNameTaken(error: unknown): boolean {
  return constraintOf(error).includes(SAME_NAME);
}

/**
 * The constraint name, from wherever the driver put it.
 *
 * `postgres` exposes it as `constraint_name`, but an error that has crossed a
 * boundary — wrapped by Drizzle, serialised, re-thrown — may only carry the
 * text. Falling back to the message means a wrapped error is still read
 * correctly instead of silently taking the "name taken" branch, which would
 * send somebody who is already going off to pick a different name.
 */
function constraintOf(error: unknown): string {
  if (typeof error !== "object" || error === null) return String(error);

  const named = error as { constraint_name?: unknown; message?: unknown; cause?: unknown };

  if (typeof named.constraint_name === "string") return named.constraint_name;

  const parts = [
    typeof named.message === "string" ? named.message : "",
    named.cause ? constraintOf(named.cause) : "",
  ];

  return parts.join(" ");
}
