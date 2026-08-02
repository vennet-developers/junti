/**
 * Telling a dead session apart from a bad moment.
 *
 * A browser can hold cookies naming a session Supabase will never honour again:
 * the account was deleted, the refresh token was revoked, the project was
 * reset. Nothing expires them — they are valid-looking strings — so every
 * request re-presents them, every request fails the same way, and the person
 * sits on a sign-in form being told the app "could not complete" something,
 * forever. The only exit is clearing site data, which nobody knows to do.
 *
 * **The distinction below is the whole point.** Clearing cookies on any failure
 * would turn a thirty-second Supabase outage, or a phone going through a
 * tunnel, into everybody being signed out — a much worse bug than the one being
 * fixed, and one that would look like the app randomly losing sessions. So this
 * only says yes when the answer came FROM Supabase and means "this session is
 * not a thing": an authentication failure, not a failure to authenticate.
 *
 * No import of the Supabase client, deliberately — it takes the error's shape
 * rather than its type, so the proxy can use it without this module dragging
 * anything into the request path.
 */

/**
 * Codes that mean the session is gone rather than momentarily unreachable.
 *
 * `user_not_found` is the one that started this: the account behind the cookie
 * was deleted while its browser still had it.
 */
const DEAD_SESSION_CODES = new Set([
  "user_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "session_expired",
  "bad_jwt",
]);

export interface SessionErrorShape {
  status?: number;
  code?: string;
}

/** Whether these cookies are worth keeping. */
export function isDeadSession(error: SessionErrorShape | null | undefined): boolean {
  if (!error) return false;

  if (error.code && DEAD_SESSION_CODES.has(error.code)) return true;

  /*
    401 and 403 only. A 5xx is Supabase having a problem, a 429 is Supabase
    asking us to wait, and `undefined` is the request never arriving — none of
    those say anything about whether the session is valid, and all three are
    transient by nature.
  */
  return error.status === 401 || error.status === 403;
}
