import "server-only";

import { cookies, headers } from "next/headers";

import {
  DEFAULT_LOCALE,
  getCopy,
  isLocale,
  localeFromAcceptLanguage,
  type Copy,
  type Locale,
} from "@/config/copy";

/**
 * Which language to render the interface in.
 *
 * Three sources, in descending order of how much they mean:
 *
 * 1. **The cookie** — the reader used the language switcher. An explicit
 *    choice, and the only one that should survive following a link to an event
 *    created in another language.
 * 2. **`Accept-Language`** — what their browser is set to. A real signal, but
 *    not a decision about this app.
 * 3. **Spanish.**
 *
 * `explicit` is what distinguishes the first from the rest: an event carries
 * its own language, and pages use it as the fallback, but never over a reader
 * who has actually chosen.
 */
export const LOCALE_COOKIE = "locale";

/** A year. The choice is a preference, not a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface ResolvedLocale {
  locale: Locale;
  /** True only when it came from the cookie — i.e. the reader chose it. */
  explicit: boolean;
}

export async function resolveViewerLocale(): Promise<ResolvedLocale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;

  if (isLocale(fromCookie)) {
    return { locale: fromCookie, explicit: true };
  }

  const headerStore = await headers();
  const fromHeader = localeFromAcceptLanguage(headerStore.get("accept-language"));

  return { locale: fromHeader ?? DEFAULT_LOCALE, explicit: false };
}

/**
 * The language for a page that belongs to an event.
 *
 * The event's own language wins over the browser's, because the organizer
 * picked it and everyone in the group chat is reading the same page. A reader
 * who has used the switcher still overrides both.
 */
export async function resolveEventLocale(eventLocale: string): Promise<Locale> {
  const viewer = await resolveViewerLocale();
  if (viewer.explicit) return viewer.locale;
  return isLocale(eventLocale) ? eventLocale : viewer.locale;
}

/** Shorthand for server components that only need the strings. */
export async function getViewerCopy(): Promise<{ copy: Copy; locale: Locale }> {
  const { locale } = await resolveViewerLocale();
  return { copy: getCopy(locale), locale };
}
