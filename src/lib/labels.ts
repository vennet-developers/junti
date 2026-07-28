import { DEFAULT_LOCALE, type Locale } from "@/config/copy";

/**
 * Reads a catalogue label out of its `jsonb` bag of translations.
 *
 * Catalogue rows store `{"es": "Partido", "en": "Match"}` rather than joining a
 * translations table, which means nothing enforces that every language is
 * present. So nobody indexes the object directly — a language somebody has not
 * filled in yet would render as `undefined` to a real reader.
 *
 * The fallback chain ends at the slug on purpose. A raw `kids_party` on screen
 * is ugly and unmistakably a missing translation; an empty string is a blank
 * space nobody notices until a user asks what happened.
 *
 * Runs on both sides — no `server-only`.
 */
export function pickLabel(
  labels: Record<string, string> | null | undefined,
  locale: Locale,
  fallback: string,
): string {
  if (!labels) return fallback;

  const exact = labels[locale];
  if (typeof exact === "string" && exact.trim().length > 0) return exact;

  const base = labels[DEFAULT_LOCALE];
  if (typeof base === "string" && base.trim().length > 0) return base;

  // Any language at all beats showing a slug.
  const any = Object.values(labels).find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  return any ?? fallback;
}

/** The same, for the optional `descriptions` bag, where absent means absent. */
export function pickOptionalLabel(
  labels: Record<string, string> | null | undefined,
  locale: Locale,
): string | null {
  if (!labels) return null;
  const picked = pickLabel(labels, locale, "");
  return picked.length > 0 ? picked : null;
}
