import { createServerFn } from "@tanstack/react-start";

/**
 * The two preference mutations, as TanStack server functions.
 *
 * Successors of `theme-actions.ts` and `locale-actions.ts` ("use server"
 * files), with the same two-place rule both always followed: the cookie is
 * what the server reads to render the very next paint, and a signed-in
 * person's account row is what makes the choice follow them to another
 * device. Read-then-write on the row so choosing a language cannot clear the
 * timezone stored beside it.
 *
 * What Next's `revalidatePath("/", "layout")` did is now the CALLER's second
 * half: these functions change cookies, and the component that invoked them
 * calls `router.invalidate()` so every loader re-reads with the new values.
 * Splitting it that way is the TanStack model — the server mutates, the
 * client decides what stale means.
 *
 * The dynamic imports keep this module loadable by client components: the
 * compiler replaces `.handler` bodies with an RPC stub in the browser bundle,
 * and everything server-only stays behind the `import()`.
 */

export const setThemeFn = createServerFn({ method: "POST" })
  .validator((data: { theme: string | null }) => data)
  .handler(async ({ data }) => {
    const [{ isTheme, loadStoredPreferences, saveStoredPreferences, writePreferenceCookie, THEME_COOKIE }, { getOrganizer }] =
      await Promise.all([import("@/lib/preferences"), import("@/lib/organizer")]);

    const theme = isTheme(data.theme) ? data.theme : null;

    await writePreferenceCookie(THEME_COOKIE, theme);

    const organizer = await getOrganizer();
    if (organizer) {
      const stored = await loadStoredPreferences(organizer.id);
      await saveStoredPreferences(organizer.id, { ...stored, theme });
    }
  });

export const setLocaleFn = createServerFn({ method: "POST" })
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    const [{ isLocale }, prefs, { getOrganizer }] = await Promise.all([
      import("@/config/copy"),
      import("@/lib/preferences"),
      import("@/lib/organizer"),
    ]);

    if (!isLocale(data.locale)) return;

    await prefs.writePreferenceCookie(prefs.LOCALE_COOKIE, data.locale);

    const organizer = await getOrganizer();
    if (organizer) {
      const stored = await prefs.loadStoredPreferences(organizer.id);
      await prefs.saveStoredPreferences(organizer.id, { ...stored, locale: data.locale });
    }
  });
