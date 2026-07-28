import "server-only";

import { getCopy, isLocale, type Copy, type Locale } from "@/config/copy";

import { resolvePreferences } from "./preferences";

/**
 * Language resolution, in terms of `preferences.ts`.
 *
 * This module is the thin, widely-imported face of that one. It exists so that
 * pages ask "what language and strings do I render in?" without having to know
 * about cookies, headers or a profile table.
 */

export { LOCALE_COOKIE, PREFERENCE_COOKIE_MAX_AGE } from "./preferences";

/**
 * The language for a page that belongs to an event.
 *
 * **The reader's browser now wins over the event's own language.** It did not
 * used to: the event's language came second, on the reasoning that the
 * organizer picked it for a page a whole group chat reads. That was reversed on
 * the owner's instruction, and the new rule is simpler to state — the interface
 * is always in the reader's language, full stop.
 *
 * The event's language survives only as a fallback for a browser that asks for
 * something we do not speak, which is better than defaulting a French reader to
 * Spanish when the event was created in English.
 *
 * Nothing a human typed is translated either way. Titles, notes and names stay
 * exactly as written.
 */
export async function resolveEventLocale(eventLocale: string): Promise<Locale> {
  const { locale, localeSource } = await resolvePreferences();

  if (localeSource !== "fallback") return locale;

  return isLocale(eventLocale) ? eventLocale : locale;
}

/** The strings for a page that belongs to an event. */
export async function getEventCopy(eventLocale: string): Promise<{ copy: Copy; locale: Locale }> {
  const locale = await resolveEventLocale(eventLocale);
  return { copy: getCopy(locale), locale };
}

/** Shorthand for a page with no event in hand. */
export async function getViewerCopy(): Promise<{ copy: Copy; locale: Locale }> {
  const { copy, locale } = await resolvePreferences();
  return { copy, locale };
}
