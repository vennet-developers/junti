import { DEFAULT_TIME_ZONE } from "./format";

/**
 * The timezone picker.
 *
 * `Intl.supportedValuesOf("timeZone")` returns around 400 identifiers, which is
 * the complete and correct answer and a terrible control: nobody scrolls to
 * "America/Argentina/Catamarca" on a phone. So the list below is curated —
 * every Spanish-speaking country plus the places this group is plausibly in —
 * and anything outside it is still accepted and still stored, it just is not
 * offered.
 *
 * Validation is deliberately NOT against this list. An event whose timezone
 * came from a browser that knows a zone we did not think to include should
 * work, not be rejected for using a real place.
 */

/** Curated, ordered roughly by how likely this group is to need each. */
export const COMMON_TIME_ZONES = [
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Caracas",
  "America/Guayaquil",
  "America/La_Paz",
  "America/Montevideo",
  "America/Asuncion",
  "America/Panama",
  "America/Costa_Rica",
  "America/Guatemala",
  "America/Tegucigalpa",
  "America/Managua",
  "America/El_Salvador",
  "America/Santo_Domingo",
  "America/Havana",
  "America/Puerto_Rico",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Toronto",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Africa/Casablanca",
  "Asia/Dubai",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

/**
 * Whether a string is a timezone this runtime understands.
 *
 * Asks `Intl` rather than checking a list, because the tz database gains,
 * renames and retires zones and any list here would be a snapshot that slowly
 * became wrong. A bad identifier makes `DateTimeFormat` throw `RangeError`,
 * which is the check.
 */
export function isValidTimeZone(value: string): boolean {
  if (value.trim().length === 0) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone the reader's device is in, when it is one we can use.
 *
 * Only a default for the create form — a good guess at where the organizer is
 * planning the event. Never used to render an existing event, which always
 * shows in its own stored zone.
 */
export function detectTimeZone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return detected && isValidTimeZone(detected) ? detected : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * A readable label: "Bogotá (GMT-5)".
 *
 * The city comes from the identifier rather than from a translated list, so a
 * zone outside `COMMON_TIME_ZONES` still labels itself sensibly. The offset is
 * computed for right now, so a zone on daylight saving reads as its current
 * offset, which is what someone checking the list expects to see.
 */
export function timeZoneLabel(timeZone: string, intlLocale: string, at: Date): string {
  const city = timeZone.split("/").slice(-1)[0]?.replaceAll("_", " ") ?? timeZone;

  let offset = "";
  try {
    const parts = new Intl.DateTimeFormat(intlLocale, {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);

    offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    offset = "";
  }

  return offset ? `${city} (${offset})` : city;
}

/**
 * Options for the picker: the curated list, plus the reader's own zone when it
 * is not already in it, so their answer is always one tap away.
 */
export function timeZoneOptions(
  current: string,
  intlLocale: string,
  at: Date,
): { value: string; label: string }[] {
  const values = new Set<string>(COMMON_TIME_ZONES);
  if (isValidTimeZone(current)) values.add(current);

  return [...values]
    .map((value) => ({ value, label: timeZoneLabel(value, intlLocale, at) }))
    .sort((a, b) => a.label.localeCompare(b.label, intlLocale));
}
