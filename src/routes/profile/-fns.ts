import { createServerFn } from "@tanstack/react-start";

import type { Locale } from "@/config/copy";

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
 *
 * What `revalidatePath("/", "layout")` did under Next is now the caller's job:
 * every rendered string can change, not just this page, so the form calls
 * `router.invalidate()` after a successful save.
 */
export const saveProfileFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data: formData }): Promise<ProfileState> => {
    const [{ isLocale }, { getViewerCopy }, { getOrganizer }, prefs, { isValidTimeZone }, { isSupportedCurrency }, { field }] =
      await Promise.all([
        import("@/config/copy"),
        import("@/lib/locale"),
        import("@/lib/organizer"),
        import("@/lib/preferences"),
        import("@/lib/time-zones"),
        import("@/lib/format"),
        import("@/lib/validation"),
      ]);

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

    // Empty means "the app's default" (COP), stored as NULL like the others.
    const rawCurrency = field(formData, "currency");
    let currency: string | null = null;
    if (rawCurrency !== "") {
      if (!isSupportedCurrency(rawCurrency)) {
        return { errors: { currency: copy.common.unknownError } };
      }
      currency = rawCurrency.toUpperCase();
    }

    // The theme lives in the same row but is set from the profile menu, not from
    // this form. Read it back and pass it through, or saving language would
    // silently reset somebody's dark mode.
    const stored = await prefs.loadStoredPreferences(organizer.id);

    // Read-then-write: this form owns language and timezone, and must not clear
    // the appearance or the invitation template stored in the same row.
    await prefs.saveStoredPreferences(organizer.id, {
      ...stored,
      locale,
      timeZone,
      currency,
    });

    await prefs.writePreferenceCookie(prefs.LOCALE_COOKIE, locale);

    // Clearing the timezone cookie rather than leaving it is deliberate: the same
    // cookie is where browser detection lands, so removing it lets `TimeZoneSync`
    // put the device's real zone back on the next page.
    await prefs.writePreferenceCookie(prefs.TIME_ZONE_COOKIE, timeZone);

    return { errors: {}, ok: true };
  });

/**
 * Withdraws the WhatsApp permission and deletes the number.
 *
 * **Deletes, not flags.** The organizer's roster reads `user_profiles.phone`
 * directly; a number left in the column behind a "revoked" bit somewhere else
 * is one careless join away from still being shown, and "we stopped meaning it"
 * is not what withdrawal means. Clearing the column is the only version of this
 * that cannot be undone by a future query.
 *
 * The withdrawal is its own row in the consent ledger rather than an edit to
 * the grant. Both facts stay true: they agreed on one date, and changed their
 * mind on another. That pair is what the ledger exists to preserve.
 *
 * Next's `revalidatePath(ROUTES.profile)` became the caller's
 * `router.invalidate()`, same as the save above.
 */
export const revokeWhatsAppFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ProfileState> => {
    const [{ recordConsent }, { clearPhone }, { clientIp }, { getViewerCopy }, { getOrganizer }, { getRequest }] =
      await Promise.all([
        import("@/lib/consent"),
        import("@/lib/profile"),
        import("@/lib/rate-limit"),
        import("@/lib/locale"),
        import("@/lib/organizer"),
        import("@tanstack/react-start/server"),
      ]);

    const { copy } = await getViewerCopy();

    const organizer = await getOrganizer();
    if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

    await clearPhone(organizer.id);

    await recordConsent(organizer.id, {
      purpose: "organizer_whatsapp",
      channel: "whatsapp",
      granted: false,
      sourceIp: clientIp(getRequest().headers),
    });

    return { errors: {}, ok: true };
  },
);
