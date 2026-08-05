/**
 * An event as a calendar file.
 *
 * RFC 5545, generated here as a pure function so the awkward parts — escaping,
 * line folding, the difference between a stable UID and a unique one — are
 * testable without a mail server. Every one of them is the sort of thing that
 * looks fine until a calendar refuses the file with no explanation.
 *
 * **Times are UTC**, with the `Z` suffix, rather than a local time plus a
 * `VTIMEZONE` block. Three reasons, in order of how much they cost to get
 * wrong:
 *
 * 1. A `VTIMEZONE` block has to describe the zone's DST rules, and a wrong one
 *    is worse than none — it silently shifts the entry by an hour for half the
 *    year. The database stores an instant; converting it to UTC cannot be
 *    wrong.
 * 2. Every client handles `Z`. `TZID` with an unfamiliar zone is where the
 *    "imports into Outlook" acceptance criterion goes to die.
 * 3. It is not a floating time, which is what AC-2 is actually guarding
 *    against — a floating time means "7pm wherever you happen to be", and an
 *    event has a place.
 *
 * The app shows the event in its own zone on purpose, so nobody does mental
 * arithmetic about when it starts *there*. A calendar entry answers a
 * different question — when do I need to be free — and for somebody reading
 * from another country the right answer is their own clock.
 */

export interface IcsEvent {
  /** The event's own id. Becomes the UID, so an update replaces rather than duplicates. */
  id: string;
  title: string;
  startsAt: Date;
  /** Junti has no end time; the calendar needs one. See `DEFAULT_DURATION_MS`. */
  endsAt?: Date;
  location: string | null;
  /** Absolute, so the entry can get back to the event from any client. */
  url: string;
  /** Free text from the organizer. Escaped here, never by the caller. */
  notes: string | null;
  /**
   * Bumped on every change. Calendars use it to decide whether an arriving
   * copy is newer than the one they hold — without it, an update is ignored.
   */
  sequence: number;
  /** `CANCEL` removes the entry from a calendar that already has it. */
  method: "REQUEST" | "CANCEL";
  /**
   * When this copy of the file was produced.
   *
   * Required by the spec, and passed in rather than read from the clock here
   * so this whole module stays a pure function of its input — which is what
   * makes it testable without freezing time. Callers pass `new Date()`.
   */
  stamp: Date;
}

/**
 * How long an event lasts, when nobody said.
 *
 * Junti does not ask for an end time, and a calendar entry needs one — an
 * event with no DTEND is treated as lasting a day by some clients, which turns
 * a football match into an all-day block. Two hours is the shape of the things
 * this app is for: a match, a dinner, a walk.
 */
export const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * `20260821T210000Z`.
 *
 * Hand-rolled rather than `toISOString().replace(...)`, because the replace
 * version is the kind of line somebody later "simplifies" into breaking. This
 * is explicit about producing exactly the basic format the spec wants.
 */
export function toIcsUtc(date: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");

  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Escapes a value for a text property.
 *
 * The order matters: backslashes first, or the escapes added afterwards get
 * escaped again. A comma or a semicolon left raw ends the property early and
 * the calendar reads the rest of somebody's location as a new field.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Folds a line at 75 octets, per RFC 5545 section 3.1.
 *
 * Counted in **bytes, not characters**, which is the whole reason this is not
 * a one-line slice: "Fútbol" is six characters and seven bytes, and a fold
 * that splits a multi-byte character produces a file some clients reject and
 * others render with a replacement glyph in the middle of a title.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let bytes = 0;
  // The continuation marker (CRLF + space) means later lines have one less
  // octet to work with.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;

    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }

    current += char;
    bytes += size;
  }

  if (current) out.push(current);
  return out.join("\r\n ");
}

/**
 * The file.
 *
 * `PRODID` names the app, `CRLF` line endings because the spec says so and
 * some clients enforce it, and every text value goes through `escapeText`
 * before it goes through `foldLine` — folding first would count the escapes'
 * bytes against the wrong line.
 */
export function buildIcs(event: IcsEvent): string {
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + DEFAULT_DURATION_MS);

  const description = [event.notes, event.url].filter(Boolean).join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vennet//Junti//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${event.method}`,
    "BEGIN:VEVENT",
    // Stable, and derived from the event's own id: the same event always
    // produces the same UID, which is what makes an update replace the entry
    // instead of adding a second one next to it.
    `UID:${event.id}@junti.vennet.dev`,
    `DTSTAMP:${toIcsUtc(event.stamp)}`,
    `DTSTART:${toIcsUtc(event.startsAt)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SEQUENCE:${event.sequence}`,
    `STATUS:${event.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `SUMMARY:${escapeText(event.title)}`,
    `URL:${escapeText(event.url)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * The filename a mail client shows.
 *
 * Always the same, and deliberately: a calendar attachment is recognised by
 * its media type, and a title-derived filename would carry the event's name —
 * and somebody's event name — into a place it does not need to be.
 */
export const ICS_FILENAME = "evento.ics";
