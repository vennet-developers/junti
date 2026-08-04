import "@/server/assert-server";

import { eq } from "drizzle-orm";
import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";

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
export const THEME_COOKIE = "theme";

/** A year. These are preferences, not sessions. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * A forced appearance, or NULL to follow the operating system.
 *
 * There is no "system" value stored anywhere: absence IS system. Modelling it
 * as a third string would create two ways to say the same thing and a question
 * about which wins.
 */
export type Theme = "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export interface StoredPreferences {
  /** NULL means "follow my browser". */
  locale: Locale | null;
  timeZone: string | null;
  /** NULL means "follow my operating system". */
  theme: Theme | null;
  /**
   * The organizer's own invitation template, or NULL for the app's.
   *
   * The odd one out in this record: the other three decide what this person
   * sees, and this one decides what everybody they invite receives. It lives
   * here because it is stored per account like the rest, and it is edited
   * somewhere else — `/messages` rather than `/profile` — for exactly that
   * difference.
   */
  shareMessage: string | null;
}

/** Where the language came from, which decides whether an event may override it. */
export type LocaleSource = "preference" | "browser" | "fallback";

export interface ResolvedPreferences {
  locale: Locale;
  localeSource: LocaleSource;
  /**
   * The forced appearance, or null to let the OS decide. Rendered onto <html>
   * server-side, which is what keeps a dark-mode reader from being flashed a
   * white page on first paint.
   */
  theme: Theme | null;
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
  const cookieLocale = readCookieLocale(getCookie(LOCALE_COOKIE));
  const timeZone = readCookieTimeZone(getCookie(TIME_ZONE_COOKIE));
  const themeValue = getCookie(THEME_COOKIE);
  const theme = isTheme(themeValue) ? themeValue : null;

  if (cookieLocale) {
    return {
      locale: cookieLocale,
      localeSource: "preference",
      timeZone,
      theme,
      copy: getCopy(cookieLocale),
    };
  }

  const fromHeader = localeFromAcceptLanguage(getRequestHeader("accept-language") ?? null);

  if (fromHeader) {
    return {
      locale: fromHeader,
      localeSource: "browser",
      timeZone,
      theme,
      copy: getCopy(fromHeader),
    };
  }

  return {
    locale: DEFAULT_LOCALE,
    localeSource: "fallback",
    timeZone,
    theme,
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
    .select({
      locale: userPreferences.locale,
      timeZone: userPreferences.timeZone,
      theme: userPreferences.theme,
      shareMessage: userPreferences.shareMessage,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return {
    locale: isLocale(row?.locale) ? row.locale : null,
    timeZone: row?.timeZone && isValidTimeZone(row.timeZone) ? row.timeZone : null,
    theme: isTheme(row?.theme) ? row.theme : null,
    // Validated on the way in, not on the way out: a template that lost its
    // link would leave every share link broken with nothing to explain it.
    shareMessage: row?.shareMessage ?? null,
  };
}

/**
 * The invitation template an event's owner writes, or the one the app ships.
 *
 * Takes the OWNER's id rather than the viewer's, because a co-organizer holding
 * the manage link should send the owner's message, not their own — the wording
 * belongs to whoever's event it is. The nullable owner this used to accept is
 * gone with the events that had none.
 */
export async function loadShareTemplate(ownerId: string, fallback: string): Promise<string> {
  const [row] = await db
    .select({ shareMessage: userPreferences.shareMessage })
    .from(userPreferences)
    .where(eq(userPreferences.userId, ownerId))
    .limit(1);

  return row?.shareMessage?.trim() || fallback;
}

/** Writes the durable record. NULL on either field clears that override. */
export async function saveStoredPreferences(
  userId: string,
  next: StoredPreferences,
): Promise<void> {
  await db
    .insert(userPreferences)
    .values({
      userId,
      locale: next.locale,
      timeZone: next.timeZone,
      theme: next.theme,
      shareMessage: next.shareMessage,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        locale: next.locale,
        timeZone: next.timeZone,
        theme: next.theme,
        shareMessage: next.shareMessage,
        updatedAt: new Date(),
      },
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
  if (value === null) {
    deleteCookie(name);
    return;
  }

  setCookie(name, value, {
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
  await writePreferenceCookie(THEME_COOKIE, stored.theme);

  // The timezone cookie is also where browser detection lands, so it is only
  // cleared when the person actually asked to follow their browser.
  if (stored.timeZone) {
    await writePreferenceCookie(TIME_ZONE_COOKIE, stored.timeZone);
  }
}
