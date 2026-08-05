import { describe, expect, it } from "vitest";

import { DEFAULT_DURATION_MS, buildIcs, escapeText, foldLine, toIcsUtc } from "./ics";

/**
 * The parts of RFC 5545 that fail silently.
 *
 * A malformed ICS does not throw — a calendar either refuses the file with no
 * explanation or, worse, imports something subtly wrong: an entry an hour off,
 * a title cut in half, a second copy of an event that was meant to be an
 * update. None of that surfaces without a real client, which is exactly why
 * the generation is a pure function and tested here.
 */

const base = {
  id: "019fcd1d-6c6d-7280-a102-af2617fa8fc3",
  title: "Fútbol de los jueves",
  startsAt: new Date("2026-08-21T21:00:00.000Z"),
  location: "Cancha La 90",
  url: "https://junti.vennet.dev/e/abc123",
  notes: null,
  sequence: 0,
  method: "REQUEST" as const,
  stamp: new Date("2026-08-04T12:00:00.000Z"),
};

describe("times", () => {
  it("writes the basic UTC format the spec asks for", () => {
    expect(toIcsUtc(new Date("2026-08-21T21:00:00.000Z"))).toBe("20260821T210000Z");
  });

  it("pads every field, including a single-digit month", () => {
    expect(toIcsUtc(new Date("2026-01-05T04:03:02.000Z"))).toBe("20260105T040302Z");
  });

  it("never emits a floating time", () => {
    // The failure this guards: a time with no zone means "7pm wherever you
    // are", and an event happens somewhere.
    const ics = buildIcs(base);
    for (const line of ics.split("\r\n").filter((l) => /^DT(START|END|STAMP)/.test(l))) {
      expect(line).toMatch(/Z$/);
    }
  });

  it("gives an event with no end time a default duration", () => {
    const ics = buildIcs(base);
    const expected = toIcsUtc(new Date(base.startsAt.getTime() + DEFAULT_DURATION_MS));
    expect(ics).toContain(`DTEND:${expected}`);
  });

  it("uses a real end time when there is one", () => {
    const ics = buildIcs({ ...base, endsAt: new Date("2026-08-21T22:30:00.000Z") });
    expect(ics).toContain("DTEND:20260821T223000Z");
  });
});

describe("escaping", () => {
  it("escapes the characters that would end a property early", () => {
    // Raw, "Cancha La 90, Medellín" would make everything after the comma a
    // second field and the location would arrive truncated.
    expect(escapeText("Cancha La 90, Medellín")).toBe("Cancha La 90\\, Medellín");
    expect(escapeText("a;b")).toBe("a\\;b");
    expect(escapeText("línea\notra")).toBe("línea\\notra");
  });

  it("escapes backslashes first, so the escapes are not escaped again", () => {
    expect(escapeText("a\\b,c")).toBe("a\\\\b\\,c");
  });

  it("carries an escaped title through to the file", () => {
    const ics = buildIcs({ ...base, title: "Asado, cerveza; y música" });
    expect(ics).toContain("SUMMARY:Asado\\, cerveza\\; y música");
  });
});

describe("line folding", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:corto")).toBe("SUMMARY:corto");
  });

  it("folds a long line with a continuation space", () => {
    const folded = foldLine("SUMMARY:" + "a".repeat(200));
    expect(folded).toContain("\r\n ");
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(76);
    }
  });

  /**
   * The reason this counts bytes rather than characters. "ú" is one character
   * and two bytes; folding on character count produces lines over the limit,
   * and folding mid-character produces a file that renders a replacement glyph
   * in the middle of somebody's event title.
   */
  it("never splits a multi-byte character", () => {
    const folded = foldLine("SUMMARY:" + "áéíóú".repeat(40));

    for (const part of folded.split("\r\n")) {
      // A split surrogate or a broken UTF-8 sequence round-trips as U+FFFD.
      expect(part).not.toContain("�");
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(76);
    }

    // And nothing is lost.
    expect(folded.split("\r\n ").join("")).toBe("SUMMARY:" + "áéíóú".repeat(40));
  });
});

describe("the file", () => {
  it("has the envelope every client looks for", () => {
    const ics = buildIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("uses CRLF, which some clients enforce", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("\r\n");
    // No bare newline anywhere.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  /**
   * The difference between an update and a duplicate. A UID derived from the
   * event id is the same every time; a random one would put a second copy of
   * Thursday football in the calendar every time anything changed.
   */
  it("derives a stable UID from the event id", () => {
    expect(buildIcs(base)).toContain(`UID:${base.id}@junti.vennet.dev`);
    expect(buildIcs({ ...base, title: "otro nombre", sequence: 3 })).toContain(
      `UID:${base.id}@junti.vennet.dev`,
    );
  });

  it("carries the sequence, so a calendar knows which copy is newer", () => {
    expect(buildIcs({ ...base, sequence: 0 })).toContain("SEQUENCE:0");
    expect(buildIcs({ ...base, sequence: 4 })).toContain("SEQUENCE:4");
  });

  it("cancels with both METHOD and STATUS", () => {
    // A client needs the method to know what to do with the file and the
    // status to know what the entry became. Sending one without the other
    // leaves the entry sitting there.
    const ics = buildIcs({ ...base, method: "CANCEL", sequence: 1 });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("confirms by default", () => {
    expect(buildIcs(base)).toContain("METHOD:REQUEST");
    expect(buildIcs(base)).toContain("STATUS:CONFIRMED");
  });

  it("includes the location and a way back to the event", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("LOCATION:Cancha La 90");
    expect(ics).toContain("URL:https://junti.vennet.dev/e/abc123");
    expect(ics).toContain("junti.vennet.dev/e/abc123");
  });

  it("omits the location rather than sending an empty one", () => {
    expect(buildIcs({ ...base, location: null })).not.toContain("LOCATION:");
  });

  it("puts the organizer's notes in the description with the link", () => {
    const ics = buildIcs({ ...base, notes: "Llevar camiseta blanca" });
    expect(ics).toContain("DESCRIPTION:Llevar camiseta blanca");
  });
});
