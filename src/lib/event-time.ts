import type { Copy } from "@/config/copy";

import { formatEventDateTime, formatEventDateTimeShort } from "./format";
import { timeZoneCity } from "./time-zones";

/**
 * How an event's start time is shown to one reader.
 *
 * Times are stored as UTC instants; this is the only place that decides which
 * wall clock to render them on. Two rules, and the second is what makes the
 * first safe:
 *
 * 1. **Render in the reader's zone**, so somebody abroad sees a time they can
 *    act on without doing arithmetic.
 * 2. **Never show a converted time without naming its zone, and show the
 *    event's own alongside whenever they differ.** A bare "4:30 a.m." on a page
 *    two friends are reading in different countries is how a group ends up
 *    disagreeing about when the match is. Both times, both places, always.
 *
 * `secondary` is null when the reader is already in the event's zone, which is
 * the overwhelmingly common case — a group of friends playing in one city sees
 * exactly one line, as it did before any of this existed.
 */
export interface EventTimeView {
  /** Full date and time in the reader's zone, with the place named. */
  primary: string;
  /** The event's own local time, or null when it is the same zone. */
  secondary: string | null;
}

export function describeEventTime({
  startsAt,
  eventTimeZone,
  readerTimeZone,
  copy,
}: {
  startsAt: Date;
  eventTimeZone: string;
  /** The reader's zone, or the event's when nothing better is known. */
  readerTimeZone: string;
  copy: Copy;
}): EventTimeView {
  const sameZone = readerTimeZone === eventTimeZone;

  const primary = `${formatEventDateTime(startsAt, readerTimeZone, copy.intlLocale)} · ${copy.event.inZone(
    timeZoneCity(readerTimeZone),
  )}`;

  if (sameZone) {
    return { primary, secondary: null };
  }

  return {
    primary,
    secondary: copy.event.eventLocalTime(
      formatEventDateTimeShort(startsAt, eventTimeZone, copy.intlLocale),
      timeZoneCity(eventTimeZone),
    ),
  };
}

/**
 * The one-line form, for a WhatsApp message or a list.
 *
 * Always carries its zone, for the same reason: the organizer pastes this into
 * a group chat where somebody may be reading it from another country.
 */
export function shortEventTime(startsAt: Date, timeZone: string, copy: Copy): string {
  return `${formatEventDateTimeShort(startsAt, timeZone, copy.intlLocale)} (${timeZoneCity(timeZone)})`;
}
