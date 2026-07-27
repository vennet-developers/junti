/**
 * Presentation-layer formatting.
 *
 * Timestamps are stored UTC and only ever rendered in America/Bogota — the
 * group this app is for is all in one timezone, and showing a match time in the
 * viewer's local zone would be actively wrong for the one person travelling.
 *
 * No `server-only` here: these run on both sides.
 */

export const EVENT_TIME_ZONE = "America/Bogota";

const LOCALE = "es-CO";

/**
 * How many minor units make one major unit, by ISO 4217 code.
 *
 * COP is the case that matters: the centavo is legally defined but has not
 * circulated in decades, so prices are quoted in whole pesos. Treating it as
 * exponent 0 means `cost_amount_minor` holds pesos directly and nothing ever
 * displays "$ 50.000,00".
 */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  COP: 0,
  CLP: 0,
  JPY: 0,
  KRW: 0,
  PYG: 0,
  VND: 0,
};

function exponentFor(currency: string): number {
  return MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2;
}

/** Converts a stored minor-unit integer to its major-unit value for display. */
export function toMajorUnits(amountMinor: number, currency: string): number {
  const exponent = exponentFor(currency);
  return exponent === 0 ? amountMinor : amountMinor / 10 ** exponent;
}

/** Converts user-entered major units to the integer we store. */
export function toMinorUnits(amountMajor: number, currency: string): number {
  const exponent = exponentFor(currency);
  return exponent === 0 ? Math.round(amountMajor) : Math.round(amountMajor * 10 ** exponent);
}

/**
 * Formats money for display: `$ 50.000` for COP, `$ 50.000,25` for a currency
 * with cents.
 */
export function formatMoney(amountMinor: number, currency: string): string {
  const exponent = exponentFor(currency);

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(toMajorUnits(amountMinor, currency));
}

/** Long form for the event header: "jueves, 12 de marzo de 2026, 8:00 p. m." */
export function formatEventDateTime(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);
}

/** Short form for the WhatsApp message: "jue 12 mar, 8:00 p. m." */
export function formatEventDateTimeShort(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);
}

/**
 * Renders a UTC instant as the `YYYY-MM-DDTHH:mm` string an
 * `<input type="datetime-local">` expects, expressed in Bogota time.
 *
 * The input has no timezone concept, so this is how a stored event survives a
 * round trip through the edit form without drifting by the UTC offset.
 */
export function toDateTimeLocalValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIME_ZONE,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  // `hourCycle` can yield "24" for midnight in some engines; normalise it.
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Parses a `datetime-local` value as Bogota wall-clock time and returns the
 * corresponding UTC instant.
 *
 * `new Date("2026-03-12T20:00")` would interpret the string in the *server's*
 * timezone, which on Vercel is UTC — silently shifting every event by five
 * hours. This computes the real offset for that instant instead of assuming a
 * fixed -05:00, so it stays correct if Colombia ever adopts DST again.
 */
export function fromDateTimeLocalValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;

  // Treat the wall-clock reading as if it were UTC, then correct by however far
  // Bogota was from UTC at that moment.
  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0"),
  );

  if (Number.isNaN(asUtc)) return null;

  const offsetMs = zoneOffsetMs(new Date(asUtc));
  const result = new Date(asUtc - offsetMs);

  return Number.isNaN(result.getTime()) ? null : result;
}

/** Milliseconds America/Bogota is ahead of UTC at `instant` (negative in practice). */
function zoneOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const hour = get("hour") === 24 ? 0 : get("hour");

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );

  return asIfUtc - instant.getTime();
}
