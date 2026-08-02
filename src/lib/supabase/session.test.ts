import { describe, expect, it } from "vitest";

import { isDeadSession } from "./session";

/**
 * The two ways this can be wrong are not symmetrical, and the tests are
 * weighted accordingly.
 *
 * Saying "alive" about a dead session leaves somebody stuck on a sign-in form
 * that will never work — annoying, and what this whole module exists to stop.
 * Saying "dead" about a live one signs everybody out the moment Supabase has a
 * bad minute, which looks like the app losing sessions at random and is far
 * harder to diagnose. So most of what follows is the second kind.
 */
describe("isDeadSession", () => {
  it("is false when nothing went wrong", () => {
    expect(isDeadSession(null)).toBe(false);
    expect(isDeadSession(undefined)).toBe(false);
  });

  // The one that started this: the account was deleted with its browser still
  // holding the cookie.
  it("is true for a user that no longer exists", () => {
    expect(isDeadSession({ status: 403, code: "user_not_found" })).toBe(true);
  });

  it("is true for a refresh token Supabase will not accept again", () => {
    expect(isDeadSession({ status: 400, code: "refresh_token_not_found" })).toBe(true);
    expect(isDeadSession({ status: 400, code: "refresh_token_already_used" })).toBe(true);
  });

  it("is true for an unauthenticated answer even with no code", () => {
    expect(isDeadSession({ status: 401 })).toBe(true);
    expect(isDeadSession({ status: 403 })).toBe(true);
  });

  // Everything below must NOT clear anybody's cookies.
  it("is false when Supabase is broken rather than the session", () => {
    expect(isDeadSession({ status: 500 })).toBe(false);
    expect(isDeadSession({ status: 502 })).toBe(false);
    expect(isDeadSession({ status: 503 })).toBe(false);
  });

  it("is false when Supabase is asking us to slow down", () => {
    expect(isDeadSession({ status: 429, code: "over_request_rate_limit" })).toBe(false);
  });

  it("is false when the request never arrived", () => {
    // A network failure has no status at all — a phone in a tunnel, a DNS
    // hiccup. Treating this as a dead session is how an outage becomes a mass
    // sign-out.
    expect(isDeadSession({})).toBe(false);
    expect(isDeadSession({ code: "unexpected_failure" })).toBe(false);
  });

  it("is false for an unrelated 400", () => {
    expect(isDeadSession({ status: 400, code: "validation_failed" })).toBe(false);
  });
});
