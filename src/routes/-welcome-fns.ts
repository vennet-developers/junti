import { createServerFn } from "@tanstack/react-start";

/**
 * Records that this account has seen the welcome.
 *
 * One call for both outcomes — finished and skipped — because the column is
 * one timestamp for both. The `skipped` flag reaches analytics, where knowing
 * which screen people leave on is the point, and never reaches the row, where
 * it could eventually become a reason to treat somebody differently.
 */
export const finishWelcomeFn = createServerFn({ method: "POST" })
  .validator((data: { step: number; skipped: boolean }) => data)
  .handler(async ({ data }) => {
    const [{ db }, { userPreferences }, { getOrganizer }, { track }] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/organizer"),
      import("@/lib/analytics"),
    ]);

    const organizer = await getOrganizer();
    if (!organizer) return { ok: false } as const;

    await db
      .insert(userPreferences)
      .values({ userId: organizer.id, welcomeSeenAt: new Date() })
      // Upsert, because a preferences row may not exist yet: somebody who
      // never changed a language or a timezone has nothing in this table.
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { welcomeSeenAt: new Date() },
      });

    track("welcome_finished", { step: data.step, skipped: data.skipped }, organizer.id);

    return { ok: true } as const;
  });
