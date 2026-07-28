import "server-only";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import {
  DEFAULT_LOCALE,
  getCopy,
  isLocale,
  localeFromAcceptLanguage,
  type Copy,
  type Locale,
} from "@/config/copy";
import { db } from "@/db/client";
import { userPreferences } from "@/db/schema";

import { isValidTimeZone } from "./time-zones";

/**
 * How the interface language and the reading timezone are decided.
 *
 * One rule for both, in this order:
 *
 * 1. **The cookie** — the effective value for this device. Written when someone
 *    saves their profile, uses the language switcher, or when the browser's
 *    timezone is detected for the first time.
 * 2. **The browser** — `Accept-Language` for the language. The server cannot
 *    detect a timezone at all, which is why the cookie exists for it.
 * 3. **The fallback** — Spanish, and the event's own zone where there is one.
 *
 * The cookie rather than reading the profile table on every request, because
 * the server has to know both values to render the first paint, and a database
 * round trip on a page a whole WhatsApp group opens is a cost with no benefit.
 * The table is the durable record; it re-seeds the cookie at sign-in, which is
 * what makes the setting follow somebody to a new device.
 */

export const LOCALE_COOKIE = "locale";
export const TIME_ZONE_COOKIE = "tz";

/** A year. These are preferences, not sessions. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface StoredPreferences {
  /** NULL means "follow my browser". */
  locale: Locale | null;
  timeZone: string | null;
}

/** Where the language came from, which decides whether an event may override it. */
export type LocaleSource = "preference" | "browser" | "fallback";

export interface ResolvedPreferences {
  locale: Locale;
  localeSource: LocaleSource;
  /**
   * The zone to READ times in. Null when nothing has established one, which
   * leaves each event rendering in its own zone — the safe fallback, since it
   * is the one the organizer meant.
   */
  timeZone: string | null;
  copy: Copy;
}

function readCookieLocale(value: string | undefined): Locale | null {
  return isLocale(value) ? value : null;
}

function readCookieTimeZone(value: string | undefined): string | null {
  return value && isValidTimeZone(value) ? value : null;
}

/**
 * The settings in force for whoever is asking.
 *
 * Deliberately does not touch the database. Everything it needs is on the
 * request.
 */
export async function resolvePreferences(): Promise<ResolvedPreferences> {
  const cookieStore = await cookies();

  const cookieLocale = readCookieLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const timeZone = readCookieTimeZone(cookieStore.get(TIME_ZONE_COOKIE)?.value);

  if (cookieLocale) {
    return {
      locale: cookieLocale,
      localeSource: "preference",
      timeZone,
      copy: getCopy(cookieLocale),
    };
  }

  const headerStore = await headers();
  const fromHeader = localeFromAcceptLanguage(headerStore.get("accept-language"));

  if (fromHeader) {
    return { locale: fromHeader, localeSource: "browser", timeZone, copy: getCopy(fromHeader) };
  }

  return {
    locale: DEFAULT_LOCALE,
    localeSource: "fallback",
    timeZone,
    copy: getCopy(DEFAULT_LOCALE),
  };
}

/**
 * The zone to render an event's times in.
 *
 * The reader's, when one is known; otherwise the event's own. Never the
 * server's — see DECISIONS.md, that mistake shipped once already.
 */
export function readingTimeZone(preferred: string | null, eventTimeZone: string): string {
  return preferred ?? eventTimeZone;
}

/** A signed-in person's stored settings, or nulls when they have none. */
export async function loadStoredPreferences(userId: string): Promise<StoredPreferences> {
  const [row] = await db
    .select({ locale: userPreferences.locale, timeZone: userPreferences.timeZone })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return {
    locale: isLocale(row?.locale) ? row.locale : null,
    timeZone: row?.timeZone && isValidTimeZone(row.timeZone) ? row.timeZone : null,
  };
}

/** Writes the durable record. NULL on either field clears that override. */
export async function saveStoredPreferences(
  userId: string,
  next: StoredPreferences,
): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, locale: next.locale, timeZone: next.timeZone })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { locale: next.locale, timeZone: next.timeZone, updatedAt: new Date() },
    });
}

/**
 * Puts a value in a preference cookie, or removes it.
 *
 * Not `httpOnly`: these hold a two-letter language and a timezone name, nothing
 * a script reading them could misuse, and leaving them readable lets the client
 * see what is already set without a round trip. `sameSite: lax` so following an
 * event link from WhatsApp still arrives with the reader's settings.
 */
export async function writePreferenceCookie(name: string, value: string | null): Promise<void> {
  const cookieStore = await cookies();

  if (value === null) {
    cookieStore.delete(name);
    return;
  }

  cookieStore.set(name, value, {
    maxAge: PREFERENCE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Copies a signed-in person's stored settings onto this device.
 *
 * Called from the auth callback, which is the one moment we know both who they
 * are and that the device may never have seen them before. A stored NULL
 * deliberately clears the cookie rather than leaving it: "follow my browser"
 * has to be able to travel too, or turning the override off on one device would
 * be silently undone by the next.
 */
export async function applyStoredPreferences(userId: string): Promise<void> {
  const stored = await loadStoredPreferences(userId);

  await writePreferenceCookie(LOCALE_COOKIE, stored.locale);

  // The timezone cookie is also where browser detection lands, so it is only
  // cleared when the person actually asked to follow their browser.
  if (stored.timeZone) {
    await writePreferenceCookie(TIME_ZONE_COOKIE, stored.timeZone);
  }
}
