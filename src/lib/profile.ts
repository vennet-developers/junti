import "@/server/assert-server";

import type { User } from "@supabase/supabase-js";
import { and, eq, isNull } from "drizzle-orm";

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

  // Google: complete the instant it exists, so this is the moment. Guarded
  // against the race by `sendWelcomeOnce` itself, not by the insert above.
  await sendWelcomeOnce(user.id);

  return { needsOnboarding: false };
}

/**
 * Removes the phone number, for a withdrawn permission.
 *
 * A real delete. The organizer's roster selects this column, so anything short
 * of emptying it leaves the number reachable by the next query somebody writes.
 */
export async function clearPhone(userId: string): Promise<void> {
  await db
    .update(userProfiles)
    .set({ phone: null, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId));
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

  /*
    The other door. A magic-link signup has no name until this screen, so the
    welcome waits for it — which is also when it is worth reading: the person
    has seen what Junti is and the mail can point at the next thing instead of
    landing in the same second as their sign-in link.

    Safe to call on every save, including the fifth time somebody edits their
    phone: the claim only ever succeeds once.
  */
  await sendWelcomeOnce(userId);
}

/**
 * Sends the welcome, exactly once per account, ever.
 *
 * Ivan's rule with the race taken out: rather than asking whether the account
 * exists — which is true a millisecond after it is created, by both doors —
 * this claims the send with a conditional UPDATE. Only the caller that
 * actually flips `welcomed_at` from NULL goes on to send, so two tabs
 * finishing a sign-in together produce one message, and a retry after a
 * provider failure produces none at all.
 *
 * That last part is a deliberate trade. Claiming BEFORE sending means a
 * provider outage loses somebody's welcome permanently; claiming after would
 * mean a crash between send and write mails them twice. Of the two, a missing
 * welcome is the one nobody notices and nobody is harmed by — and the outbox
 * retries around a bad minute anyway.
 *
 * Called from both doors into a usable profile: Google, which is complete the
 * instant it exists, and a magic link, which is complete when onboarding ends.
 */
export async function sendWelcomeOnce(userId: string): Promise<void> {
  const claimed = await db
    .update(userProfiles)
    .set({ welcomedAt: new Date() })
    .where(and(eq(userProfiles.userId, userId), isNull(userProfiles.welcomedAt)))
    .returning({ fullName: userProfiles.fullName });

  const profile = claimed[0];
  if (!profile) return;

  const [{ loadVerifiedEmails }, { enqueueAndSend }, { resolvePreferences }, { ROUTES }] =
    await Promise.all([
      import("@/lib/accounts"),
      import("@/lib/outbox"),
      import("@/lib/preferences"),
      import("@/config/routes"),
    ]);

  const address = (await loadVerifiedEmails([userId])).get(userId);
  if (!address) return;

  const { locale } = await resolvePreferences();

  /*
    Through the outbox like every other product message, which buys the
    retries and the suppression check — and now also puts it in the delivery
    metric, so a welcome that never goes out is visible in the panel rather
    than only in somebody's absent inbox.
  */
  await enqueueAndSend({
    message: {
      to: address,
      template: "welcome",
      locale,
      values: { name: profile.fullName, createPath: ROUTES.newEvent },
    },
    trigger: "welcome",
  });
}
