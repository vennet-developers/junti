/**
 * Presentation-layer formatting.
 *
 * Every function takes the timezone and the formatting locale explicitly.
 * Neither used to be a parameter — the module hardcoded America/Bogota and
 * es-CO — and the reason they are now is that the two answer different
 * questions and must be allowed to disagree:
 *
 * - **The timezone belongs to the event.** A match at 8 p.m. in Medellín is at
 *   8 p.m. for everyone reading the roster, including the person reading it
 *   from Madrid. Rendering in the reader's own zone would tell them 3 a.m. and
 *   be technically correct and practically useless.
 * - **The locale belongs to the reader.** Month names, the order of day and
 *   month, and where the currency symbol goes should follow whoever is looking.
 *
 * No `server-only`: these run on both sides.
 */

/** Used when a caller has no event in hand, and as the schema default. */
export const DEFAULT_TIME_ZONE = "America/Bogota";

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

/**
 * The currencies an event may be priced in.
 *
 * A product list, not a technical one — `Intl` would happily format hundreds
 * more. It exists because the amount parser has to know how many decimals a
 * currency has to read "50,50" correctly, and accepting an arbitrary
 * three-letter code meant accepting one whose conventions we had not thought
 * about. Adding one is a line here plus a check that its exponent is right.
 *
 * COP first because it is the only one the UI offers today.
 */
export const SUPPORTED_CURRENCIES = [
  "COP",
  "USD",
  "EUR",
  "MXN",
  "ARS",
  "CLP",
  "PEN",
  "BRL",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(currency: string): boolean {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(currency.toUpperCase());
}

/**
 * How many decimal places this currency is written with: 0 for COP, 2 for USD.
 *
 * Exported because parsing what the organizer typed needs it — see
 * `parseCostAmount`. Reading "50.50" as five thousand and fifty is a factor of
 * a hundred, and the only thing standing between those two readings is this
 * number.
 */
export function minorUnitExponent(currency: string): number {
  return exponentFor(currency);
}

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
 * Formats money for display: `$ 50.000` for COP read in Spanish, `$50,000` read
 * in English. Same amount, same currency, different separators.
 */
export function formatMoney(amountMinor: number, currency: string, intlLocale: string): string {
  const exponent = exponentFor(currency);

  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(toMajorUnits(amountMinor, currency));
}

/** Long form for the event header: "jueves, 12 de marzo de 2026, 8:00 p. m." */
export function formatEventDateTime(date: Date, timeZone: string, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** Short form for the WhatsApp message: "jue 12 mar, 8:00 p. m." */
export function formatEventDateTimeShort(date: Date, timeZone: string, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** Date only, for "created on" lines in the organizer's history. */
export function formatDate(date: Date, timeZone: string, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** The event day of an instant, as `YYYY-MM-DD`, for `DateTimeField`. */
export function toDatePartValue(date: Date, timeZone: string): string {
  return toDateTimeLocalValue(date, timeZone).slice(0, 10);
}

/** The event wall-clock time of an instant, as `HH:mm`, for `DateTimeField`. */
export function toTimePartValue(date: Date, timeZone: string): string {
  return toDateTimeLocalValue(date, timeZone).slice(11, 16);
}

/**
 * Renders a UTC instant as a `YYYY-MM-DDTHH:mm` wall-clock string in the given
 * zone.
 *
 * Wall-clock strings have no timezone concept, so this is how a stored event
 * survives a round trip through the edit form without drifting by the UTC
 * offset. `fromDateTimeLocalValue` is the inverse.
 *
 * Formats through `en-CA` deliberately: it is the one common locale whose date
 * order is already `YYYY-MM-DD`, so the parts come out in the order the string
 * needs regardless of what language the reader is using.
 */
export function toDateTimeLocalValue(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  // `hourCycle` can yield "24" for midnight in some engines; normalise it.
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Parses a `datetime-local` value as wall-clock time in `timeZone` and returns
 * the corresponding UTC instant.
 *
 * `new Date("2026-03-12T20:00")` would interpret the string in the *server's*
 * timezone, which on Vercel is UTC — silently shifting every event by the
 * offset. This computes the real offset for that instant instead of assuming a
 * fixed one, so it stays correct across daylight saving in the zones that have
 * it, and if Colombia ever adopts it again.
 */
export function fromDateTimeLocalValue(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;

  // Treat the wall-clock reading as if it were UTC, then correct by however far
  // the zone was from UTC at that moment.
  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0"),
  );

  if (Number.isNaN(asUtc)) return null;

  // The offset is computed at the approximate instant, then re-checked once.
  // Around a DST transition the first guess can land on the wrong side of the
  // jump; a second pass settles it, which is as far as this needs to go for
  // picking an evening kickoff.
  const firstGuess = new Date(asUtc - zoneOffsetMs(new Date(asUtc), timeZone));
  const result = new Date(asUtc - zoneOffsetMs(firstGuess, timeZone));

  return Number.isNaN(result.getTime()) ? null : result;
}

/** Milliseconds `timeZone` is ahead of UTC at `instant`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
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
