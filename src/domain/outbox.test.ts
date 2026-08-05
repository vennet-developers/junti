import { describe, expect, it } from "vitest";

import {
  MAX_ATTEMPTS,
  canRetry,
  dedupeKey,
  nextAttemptAt,
  nextAttemptDelayMs,
  nextStatus,
} from "./outbox";

/**
 * The two rules that decide whether a queue drains or grows, and whether
 * somebody gets told the same thing twice.
 */

describe("backoff", () => {
  it("waits a minute before the first retry, not zero", () => {
    // Almost everything that fails once is a blip or a rate limit, and both
    // are worse for being retried immediately.
    expect(nextAttemptDelayMs(1)).toBe(60_000);
  });

  it("doubles", () => {
    expect(nextAttemptDelayMs(2)).toBe(2 * 60_000);
    expect(nextAttemptDelayMs(3)).toBe(4 * 60_000);
    expect(nextAttemptDelayMs(4)).toBe(8 * 60_000);
    expect(nextAttemptDelayMs(5)).toBe(16 * 60_000);
  });

  it("never returns a negative or zero delay", () => {
    // A zero delay is a hot loop against a provider that is already unhappy.
    for (const attempts of [-3, 0, 1]) {
      expect(nextAttemptDelayMs(attempts)).toBeGreaterThan(0);
    }
  });

  it("schedules from the moment given, not from now", () => {
    const from = new Date("2026-08-05T10:00:00.000Z");
    expect(nextAttemptAt(1, from).toISOString()).toBe("2026-08-05T10:01:00.000Z");
    expect(nextAttemptAt(3, from).toISOString()).toBe("2026-08-05T10:04:00.000Z");
  });

  it("stops after the limit", () => {
    expect(canRetry(0)).toBe(true);
    expect(canRetry(MAX_ATTEMPTS - 1)).toBe(true);
    expect(canRetry(MAX_ATTEMPTS)).toBe(false);
    expect(canRetry(MAX_ATTEMPTS + 10)).toBe(false);
  });
});

describe("what counts as the same message", () => {
  const base = { template: "event-invitation", recipient: "ana@correo.com", eventId: "e1" };

  it("is the same for the same four parts", () => {
    expect(dedupeKey(base)).toBe(dedupeKey({ ...base }));
  });

  it("separates templates, recipients and events", () => {
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, template: "event-cancelled" }));
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, recipient: "luis@correo.com" }));
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, eventId: "e2" }));
  });

  /**
   * The part that is easy to leave out. A resend is a deliberate second copy
   * of the same invitation — without the trigger, dedupe would silently
   * swallow exactly the action an organizer just took on purpose.
   */
  it("lets a deliberate resend through", () => {
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, trigger: "resend:1" }));
    expect(dedupeKey({ ...base, trigger: "resend:1" })).not.toBe(
      dedupeKey({ ...base, trigger: "resend:2" }),
    );
  });

  it("treats an address that differs only in case as the same inbox", () => {
    expect(dedupeKey({ ...base, recipient: "Ana@Correo.com " })).toBe(dedupeKey(base));
  });

  it("survives a message with no event", () => {
    // Auth links belong to nobody's event.
    expect(dedupeKey({ template: "auth-link", recipient: "ana@correo.com" })).toContain("|-|-");
  });
});

describe("what an attempt leaves behind", () => {
  it("is done when it sent", () => {
    expect(nextStatus("sent", 1)).toBe("sent");
  });

  /**
   * Not a failure. The recipient asked not to be written to, so there is
   * nothing to retry and nothing went wrong — treating it as an error would
   * put it in an operator's list of things to fix.
   */
  it("is terminal, and not an error, when suppressed", () => {
    expect(nextStatus("suppressed", 1)).toBe("suppressed");
    expect(nextStatus("suppressed", MAX_ATTEMPTS)).toBe("suppressed");
  });

  it("stays pending while there are attempts left", () => {
    expect(nextStatus("failed", 1)).toBe("pending");
    expect(nextStatus("failed", MAX_ATTEMPTS - 1)).toBe("pending");
  });

  it("gives up at the limit", () => {
    expect(nextStatus("failed", MAX_ATTEMPTS)).toBe("failed");
  });
});
