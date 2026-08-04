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
