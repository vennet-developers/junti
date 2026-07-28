"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale } from "@/config/copy";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./locale";

/**
 * Records the reader's language choice.
 *
 * Not `httpOnly`: it holds a two-letter preference, nothing a script reading it
 * could misuse, and leaving it readable means the client can render the current
 * choice without a round trip. `sameSite: lax` so following an event link from
 * WhatsApp still arrives with the language the person picked.
 *
 * Revalidates the whole tree because the choice changes every rendered string,
 * not just the page it was made on.
 */
export async function setLocale(next: string): Promise<void> {
  if (!isLocale(next)) return;

  const cookieStore = await cookies();

  cookieStore.set(LOCALE_COOKIE, next, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
}
