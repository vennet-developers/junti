import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";

import { events } from "@/db/schema";

import { attendingCountSql, firstAttendeesSql } from "./roster-select";

/**
 * A guard for one specific, silent failure.
 *
 * The correlated subqueries in `loadOrganizerEvents` count who is going to each
 * event and pick the first few names for the avatar stack. Written the obvious
 * Drizzle way — interpolating schema columns, `${participants.eventId}` — the
 * generated SQL comes out UNQUALIFIED:
 *
 *     where "event_id" = "id"
 *
 * With `participants` in scope inside the subquery, `"id"` binds to
 * `participants.id`, so the predicate reads `participants.event_id =
 * participants.id` and matches nothing. Postgres does not complain. Every event
 * reports nobody going, forever.
 *
 * That is exactly how it shipped, and it went unnoticed until an event finally
 * had somebody on it. Asserting on rendered output would not have caught it
 * either — zero attendees is a perfectly plausible thing to render. So this
 * asserts the shape of the SQL itself, against the very fragments production
 * uses.
 */
describe("organizer event subqueries", () => {
  // A mock driver builds and renders SQL without opening a connection, so this
  // needs no database and no environment.
  const db = drizzle.mock();

  const { sql } = db
    .select({ attendingCount: attendingCountSql, firstAttendees: firstAttendeesSql })
    .from(events)
    .toSQL();

  it("correlates both subqueries against the outer events row", () => {
    expect(sql.match(/p\.event_id = events\.id/g)).toHaveLength(2);
  });

  it("never leaves the bare pair the capture bug produces", () => {
    expect(sql).not.toMatch(/"event_id"\s*=\s*"id"/);
  });

  it("aliases the inner table so its columns cannot be captured", () => {
    expect(sql.match(/from participants p\b/g)).toHaveLength(2);
  });

  it("caps the avatar stack in SQL rather than in the page", () => {
    // Bound as a parameter, but the LIMIT has to be there or the query grows
    // with the roster to fetch names nobody renders.
    expect(sql).toMatch(/limit \$\d+/);
  });
});
