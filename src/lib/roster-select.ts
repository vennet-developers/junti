import { sql } from "drizzle-orm";

/**
 * The correlated subqueries used by `loadOrganizerEvents`, kept here so a test
 * can render them to SQL without opening a database connection.
 *
 * **They are written with literal table and column names on purpose.**
 *
 * Interpolating schema columns is the obvious Drizzle way and is silently
 * wrong inside a raw `sql` template: Drizzle emits them UNQUALIFIED, so
 *
 * ```ts
 * where ${participants.eventId} = ${events.id}
 * ```
 *
 * compiles to `where "event_id" = "id"`. With `participants` in scope, `"id"`
 * binds to `participants.id`, the predicate becomes
 * `participants.event_id = participants.id`, and the subquery matches nothing.
 * Postgres raises no error. Every event reports zero people going, forever —
 * which is exactly how the attending count shipped, and it went unnoticed
 * until a card finally had somebody on it.
 *
 * The `p` alias plus the explicit `events.id` make the correlation say what it
 * means. `roster-sql.test.ts` asserts the generated SQL still does.
 */

/** How many names the avatar stack shows before collapsing into "+N". */
export const AVATAR_STACK_SIZE = 3;

/** Everyone who said they are coming. */
export const attendingCountSql = sql<number>`(
  select count(*)::int
  from participants p
  where p.event_id = events.id
    and p.attendance = 'in'
)`;

/**
 * The first few of them, oldest first, for the avatar stack.
 *
 * Capped in SQL rather than trimmed in the page: a card shows three faces and
 * a "+N", so fetching every name of every event to throw them away would grow
 * with the roster for no visible gain. Served by
 * `participants_event_created_idx`, so the limit is applied by the index
 * rather than by sorting the whole roster.
 */
export const firstAttendeesSql = sql<string[]>`(
  select coalesce(array_agg(name), '{}')
  from (
    select p.display_name as name
    from participants p
    where p.event_id = events.id
      and p.attendance = 'in'
    order by p.created_at asc
    limit ${AVATAR_STACK_SIZE}
  ) first_few
)`;
