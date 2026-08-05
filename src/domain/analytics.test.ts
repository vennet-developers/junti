import { describe, expect, it } from "vitest";

import {
  ANALYTICS_EVENTS,
  CLIENT_EVENTS,
  EVENT_SOURCE,
  isClientEvent,
  stripUnsafeProps,
} from "./analytics";

/**
 * The taxonomy, tested where it can actually be wrong.
 *
 * These are not tests of behaviour so much as of a promise: that the table in
 * `ANALYTICS.md` and the code cannot drift, and that a property nobody should
 * be recording cannot reach the database because somebody copied a nearby
 * object into a `track()` call.
 */

describe("the taxonomy is closed and complete", () => {
  it("declares a source for every event", () => {
    // The failure this catches: adding a name to the list and forgetting the
    // source map, which would fire it as `undefined` and quietly break AC-6.
    for (const name of ANALYTICS_EVENTS) {
      expect(EVENT_SOURCE[name], `no source declared for ${name}`).toMatch(
        /^(server|client)$/,
      );
    }
  });

  it("declares no source for an event that does not exist", () => {
    expect(Object.keys(EVENT_SOURCE).sort()).toEqual([...ANALYTICS_EVENTS].sort());
  });

  it("has no duplicate names", () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });

  /**
   * AC-6, as an assertion rather than a comment. A client can lie about a
   * payment and an extension can block the call, so anything that would be
   * read as revenue is recorded where the write happens.
   */
  it("keeps every money-adjacent event on the server", () => {
    for (const name of ["payment_recorded", "policy_reviewed", "policy_submitted"] as const) {
      expect(EVENT_SOURCE[name]).toBe("server");
    }
  });

  it("only lets the browser report what the server cannot know", () => {
    expect(CLIENT_EVENTS).toEqual([
      "create_started",
      "create_step_viewed",
      "create_step_completed",
      "create_abandoned",
      "event_viewed",
      "rsvp_started",
      "group_link_viewed",
    ]);
  });

  it("refuses a server event arriving from a browser", () => {
    expect(isClientEvent("event_viewed")).toBe(true);
    expect(isClientEvent("payment_recorded")).toBe(false);
    expect(isClientEvent("rsvp_completed")).toBe(false);
    expect(isClientEvent("definitivamente_no")).toBe(false);
  });
});

describe("props cannot carry what must not be recorded", () => {
  it("keeps ids, enums, numbers and booleans", () => {
    const { props, dropped } = stripUnsafeProps({
      event_id: "019fcd1d-6c6d-7280-a102-af2617fa8fc3",
      attendance: "in",
      waitlisted: false,
      batch_size: 12,
      group_id: null,
    });

    expect(dropped).toEqual([]);
    expect(props).toEqual({
      event_id: "019fcd1d-6c6d-7280-a102-af2617fa8fc3",
      attendance: "in",
      waitlisted: false,
      batch_size: 12,
      group_id: null,
    });
  });

  it("drops personal data by key", () => {
    const { props, dropped } = stripUnsafeProps({
      event_id: "e1",
      email: "ana@correo.com",
      display_name: "Ana",
      phone: "3001234567",
    });

    expect(props).toEqual({ event_id: "e1" });
    expect(dropped).toEqual(expect.arrayContaining(["email", "display_name", "phone"]));
  });

  it("drops money, because the ledger is the only place it belongs", () => {
    const { props, dropped } = stripUnsafeProps({ status: "confirmed", amount_minor: 25_000 });

    expect(props).toEqual({ status: "confirmed" });
    expect(dropped).toEqual(["amount_minor"]);
  });

  it("drops the tokens that are access, not identity", () => {
    const { props } = stripUnsafeProps({
      public_token: "seeddemo8de10ab",
      organizer_token: "seeddemo8de10organizer0000000000",
      event_id: "e1",
    });

    expect(props).toEqual({ event_id: "e1" });
  });

  /**
   * The case the key blocklist cannot catch: an innocent key holding prose
   * somebody typed. A rejection reason is free text and belongs nowhere near
   * this table.
   */
  it("drops free text hiding behind an innocent key", () => {
    const { props, dropped } = stripUnsafeProps({
      decision: "rejected",
      reason: "No se ve el número de la transferencia y la foto está muy borrosa, mándala otra vez",
    });

    expect(props).toEqual({ decision: "rejected" });
    expect(dropped).toEqual(["reason"]);
  });

  it("keeps a short string, because that is what an enum looks like", () => {
    const { props, dropped } = stripUnsafeProps({ decision: "rejected" });
    expect(dropped).toEqual([]);
    expect(props).toEqual({ decision: "rejected" });
  });

  it("never throws — a gap in a chart beats a lost RSVP", () => {
    expect(() => stripUnsafeProps({})).not.toThrow();
    // A value the type says cannot happen, because at a call site it can.
    expect(() =>
      stripUnsafeProps({ weird: undefined as unknown as null }),
    ).not.toThrow();
  });
});
