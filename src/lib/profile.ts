import "server-only";

import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { userProfiles } from "@/db/schema";

/**
 * The person behind an account: what they are called, and how to reach them.
 *
 * Separate from `organizer.ts`, which reads the same person out of the SESSION.
 * The split is who is asking. A session answers "who am I" and is all the app
 * needed while the only requirement was printing a name on a roster. This module
 * answers "who is that", which the session cannot: one account's metadata is not
 * readable by an app holding somebody else's.
 */

export interface Profile {
  fullName: string;
  /** WhatsApp. Organizer-readable only — never selected into a public view. */
  phone: string | null;
}

/** The profile for one account, or null when they have not completed one. */
export async function loadProfile(userId: string): Promise<Profile | null> {
  const [row] = await db
    .select({ fullName: userProfiles.fullName, phone: userProfiles.phone })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return row ?? null;
}

/**
 * The name an identity provider already gave us, if any.
 *
 * Google supplies one and an emailed link does not, which is the entire reason
 * the onboarding screen exists and the entire reason most people never see it.
 * The keys have moved between provider versions, so take whichever is present —
 * the same reasoning, and the same list, as `organizer.ts`.
 */
function nameFromProvider(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | null;

  for (const key of ["full_name", "name", "user_name", "preferred_username"]) {
    const value = meta?.[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }

  return null;
}

/**
 * Fills the profile from the identity provider, and says whether anything is
 * still missing.
 *
 * Called once per sign-in. Returns true when the person has to be asked, which
 * is exactly the case where nobody has told us their name: an emailed link
 * carries an address and nothing else.
 *
 * Writing here rather than making the onboarding screen do it means a Google
 * account is complete the instant it exists, with no screen in between — the
 * fast path this whole flow was built around stays fast.
 */
export async function ensureProfile(user: User): Promise<{ needsOnboarding: boolean }> {
  const existing = await loadProfile(user.id);
  if (existing) return { needsOnboarding: false };

  const provided = nameFromProvider(user);
  if (!provided) return { needsOnboarding: true };

  await db
    .insert(userProfiles)
    .values({ userId: user.id, fullName: provided })
    // Two tabs finishing a sign-in at once both get here. The row is the same
    // either way, so the loser of the race has nothing to correct.
    .onConflictDoNothing({ target: userProfiles.userId });

  return { needsOnboarding: false };
}

/** Writes what the onboarding screen collected. */
export async function saveProfile(
  userId: string,
  next: { fullName: string; phone: string | null },
): Promise<void> {
  await db
    .insert(userProfiles)
    .values({ userId, fullName: next.fullName, phone: next.phone })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { fullName: next.fullName, phone: next.phone, updatedAt: new Date() },
    });
}
