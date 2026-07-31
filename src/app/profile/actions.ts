"use server";

import { revalidatePath } from "next/cache";

import { isLocale, type Locale } from "@/config/copy";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import {
  loadStoredPreferences,
  LOCALE_COOKIE,
  saveStoredPreferences,
  TIME_ZONE_COOKIE,
  writePreferenceCookie,
} from "@/lib/preferences";
import { isValidTimeZone } from "@/lib/time-zones";
import { field } from "@/lib/validation";

export type ProfileState = { errors: Record<string, string>; ok?: boolean };

/**
 * Saves language and timezone, to the account and to this device.
 *
 * Both at once, and both are needed:
 *
 * - the **table** is what makes the setting follow somebody to a new phone;
 * - the **cookie** is what lets the server render the very next paint in the
 *   right language, without reading the database on every request.
 *
 * An empty value means "follow my browser". It is stored as NULL and the cookie
 * is removed, so the automatic detection takes over again — that is the whole
 * of the override toggle, with no second boolean to contradict the first.
 */
export async function saveProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const { copy } = await getViewerCopy();

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  const rawLocale = field(formData, "locale");
  const rawTimeZone = field(formData, "timeZone");

  // An empty value is not a mistake — it means "follow my browser".
  let locale: Locale | null = null;
  if (rawLocale !== "") {
    if (!isLocale(rawLocale)) return { errors: { locale: copy.common.unknownError } };
    locale = rawLocale;
  }

  let timeZone: string | null = null;
  if (rawTimeZone !== "") {
    if (!isValidTimeZone(rawTimeZone)) {
      return { errors: { timeZone: copy.errors.timeZoneInvalid } };
    }
    timeZone = rawTimeZone;
  }

  // The theme lives in the same row but is set from the profile menu, not from
  // this form. Read it back and pass it through, or saving language would
  // silently reset somebody's dark mode.
  const stored = await loadStoredPreferences(organizer.id);

  // Read-then-write: this form owns language and timezone, and must not clear
  // the appearance or the invitation template stored in the same row.
  await saveStoredPreferences(organizer.id, {
    ...stored,
    locale,
    timeZone,
  });

  await writePreferenceCookie(LOCALE_COOKIE, locale);

  // Clearing the timezone cookie rather than leaving it is deliberate: the same
  // cookie is where browser detection lands, so removing it lets `TimeZoneSync`
  // put the device's real zone back on the next page.
  await writePreferenceCookie(TIME_ZONE_COOKIE, timeZone);

  // Every rendered string can change, not just this page.
  revalidatePath("/", "layout");

  return { errors: {}, ok: true };
}
