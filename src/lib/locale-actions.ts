"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale } from "@/config/copy";
import { getOrganizer } from "@/lib/organizer";

import {
  LOCALE_COOKIE,
  PREFERENCE_COOKIE_MAX_AGE,
  loadStoredPreferences,
  saveStoredPreferences,
} from "./preferences";

/**
 * Records the reader's language choice.
 *
 * Not `httpOnly`: it holds a two-letter preference, nothing a script reading it
 * could misuse, and leaving it readable means the client can render the current
 * choice without a round trip. `sameSite: lax` so following an event link from
 * WhatsApp still arrives with the language the person picked.
 *
 * Signed-in people also get it written to their account, so the choice follows
 * them to another device — the same two-place rule `setTheme` follows, and the
 * same one `/profile` writes when it saves the language field. Without it the
 * two disagree: the drawer would move the cookie while the account row kept
 * the old language, so `/profile` would show one answer and the next device
 * another.
 *
 * Revalidates the whole tree because the choice changes every rendered string,
 * not just the page it was made on.
 */
export async function setLocale(next: string): Promise<void> {
  if (!isLocale(next)) return;

  const cookieStore = await cookies();

  cookieStore.set(LOCALE_COOKIE, next, {
    maxAge: PREFERENCE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const organizer = await getOrganizer();
  if (organizer) {
    // Read-then-write so choosing a language cannot clear the timezone or the
    // appearance stored in the same row.
    const stored = await loadStoredPreferences(organizer.id);
    await saveStoredPreferences(organizer.id, { ...stored, locale: next });
  }

  revalidatePath("/", "layout");
}
