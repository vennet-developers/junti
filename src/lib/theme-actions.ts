"use server";

import { revalidatePath } from "next/cache";

import { getOrganizer } from "@/lib/organizer";
import {
  isTheme,
  loadStoredPreferences,
  saveStoredPreferences,
  THEME_COOKIE,
  writePreferenceCookie,
  type Theme,
} from "@/lib/preferences";

/**
 * Records the reader's appearance choice.
 *
 * `null` means "follow my operating system", which is the state everybody
 * starts in — the palette already ships a `prefers-color-scheme` block, so
 * doing nothing is a working default rather than an unset one.
 *
 * The cookie is what the server reads to stamp `data-mode` on `<html>` during
 * render. Doing it there instead of in a client effect is the whole point: a
 * dark-mode reader never gets flashed a white page while JavaScript loads.
 *
 * Signed-in people also get it written to their account, so the choice follows
 * them to another device — the same two-place rule as language and timezone.
 */
export async function setTheme(next: string | null): Promise<void> {
  const theme: Theme | null = isTheme(next) ? next : null;

  await writePreferenceCookie(THEME_COOKIE, theme);

  const organizer = await getOrganizer();
  if (organizer) {
    // Read-then-write so this action cannot clear the settings it does not own.
    const stored = await loadStoredPreferences(organizer.id);
    await saveStoredPreferences(organizer.id, { ...stored, theme });
  }

  // Every page carries the attribute, so the whole tree has to re-render.
  revalidatePath("/", "layout");
}
