import "@/server/assert-server";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/**
 * Verified addresses, read at the moment of sending and never copied.
 *
 * The one place this app looks up somebody else's email — and it looks it up
 * in `auth.users`, the record the provider verified, rather than in a table of
 * our own. That is the whole privacy posture of invitations in one function:
 * an organizer never types an address, we never store one, and the only reason
 * this query exists is that an email has to be addressed to something.
 *
 * Reading `auth.*` from application code is unusual and deliberate. The
 * alternative — copying addresses into `user_profiles` so Drizzle could join
 * them — would recreate exactly the pile of third-party addresses that groups
 * were built to eliminate.
 *
 * Callers must already have established that the person consented (a joined
 * group membership). This function answers "where do I send it", never "may I
 * send it".
 */
export async function loadVerifiedEmails(userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  /*
    Parameterised, not interpolated. These ids come from our own tables, so
    injection is theoretical — but a hand-built IN list is the pattern that
    stops being theoretical the day somebody reuses this helper with an id
    that came from a URL.
  */
  const ids = sql.join(
    userIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

  const rows = await db.execute<{ id: string; email: string | null }>(
    sql`select id::text, email from auth.users where id in (${ids})`,
  );

  const found = new Map<string, string>();
  for (const row of rows) {
    if (row.email) found.set(row.id, row.email.toLowerCase());
  }

  return found;
}

/**
 * Display names for a handful of accounts, for lists that name people the
 * reader already shares something with.
 *
 * `user_profiles`, never `auth.users`: the name somebody chose to be known by
 * is ours to read, and their address is not — see the note above. An id with
 * no profile row simply comes back missing rather than as a placeholder,
 * because the caller knows better than this function what an unknown name
 * should read as.
 */
export async function loadDisplayNames(
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();

  const { inArray } = await import("drizzle-orm");
  const { userProfiles } = await import("@/db/schema");

  const rows = await db
    .select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, unique));

  return new Map(rows.map((row) => [row.userId, row.fullName]));
}
