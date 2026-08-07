import "@/server/assert-server";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  DIRECTORY_PAGE_SIZE,
  escapeLike,
  pageCount,
  type DirectoryQuery,
} from "@/domain/directory";
import type { PanelRange } from "@/domain/panel-range";

/**
 * The panel's directory queries: who exists, one page at a time.
 *
 * One page of twenty and a total, never the whole table — the point of the
 * feature is reading the data without shipping it. `count(*) over()` rides
 * on the page query so the total costs no second round trip against the
 * pooler this app has already measured stalling under bursts.
 *
 * Every list respects the panel's date range on CREATION time, like every
 * other number on the page — the range chips above the tabs are the
 * directory's date filter, not a separate machinery.
 *
 * The rows carry emails and phone-less profile names to exactly one reader:
 * the route 404s for anybody but the owner, which is what makes an email
 * column tolerable here and nowhere else.
 */

export interface DirectoryRow {
  id: string;
  /** The display name / title / group name — what the row is called. */
  name: string;
  /** Owner email for users, organizer name for events, owner name for groups. */
  detail: string;
  createdAtISO: string;
  /** Type-specific counts, already sentence-ready — see the copy block. */
  meta: { events: number; rsvps: number } | { attending: number; costMode: string; cancelled: boolean; startsAtISO: string } | { members: number; events: number };
}

export interface DirectoryPage {
  rows: DirectoryRow[];
  total: number;
  page: number;
  pages: number;
}

export async function loadDirectory(
  range: PanelRange,
  query: DirectoryQuery,
): Promise<DirectoryPage> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const like = query.q === "" ? null : `%${escapeLike(query.q)}%`;
  const offset = (query.page - 1) * DIRECTORY_PAGE_SIZE;

  if (query.kind === "usuarios") {
    const rows = await db.execute<{
      id: string;
      name: string;
      email: string | null;
      created_at: Date;
      events: string;
      rsvps: string;
      total: string;
    }>(sql`
      select
        p.user_id::text as id,
        p.full_name as name,
        u.email,
        p.created_at,
        (select count(*) from events e where e.organizer_id = p.user_id)::text as events,
        (select count(*) from participants pa where pa.user_id = p.user_id)::text as rsvps,
        count(*) over()::text as total
      from user_profiles p
      left join auth.users u on u.id = p.user_id
      where p.created_at >= ${from} and p.created_at < ${to}
        ${like === null ? sql`` : sql`and (p.full_name ilike ${like} or u.email ilike ${like})`}
      order by p.created_at desc
      limit ${DIRECTORY_PAGE_SIZE} offset ${offset}
    `);

    return shape(
      [...rows].map((row) => ({
        id: row.id,
        name: row.name,
        detail: row.email ?? "",
        createdAtISO: new Date(row.created_at).toISOString(),
        meta: { events: Number(row.events), rsvps: Number(row.rsvps) },
      })),
      Number(rows[0]?.total ?? 0),
      query.page,
    );
  }

  if (query.kind === "eventos") {
    const stateClause =
      query.filter === "con_costo"
        ? sql`and e.cost_mode <> 'none'`
        : query.filter === "gratis"
          ? sql`and e.cost_mode = 'none'`
          : query.filter === "cancelados"
            ? sql`and e.cancelled_at is not null`
            : sql``;

    const rows = await db.execute<{
      id: string;
      name: string;
      organizer: string | null;
      created_at: Date;
      starts_at: Date;
      cost_mode: string;
      cancelled: boolean;
      attending: string;
      total: string;
    }>(sql`
      select
        e.id::text as id,
        e.title as name,
        p.full_name as organizer,
        e.created_at,
        e.starts_at,
        e.cost_mode,
        (e.cancelled_at is not null) as cancelled,
        (select count(*) from participants pa
           where pa.event_id = e.id and pa.attendance = 'in')::text as attending,
        count(*) over()::text as total
      from events e
      left join user_profiles p on p.user_id = e.organizer_id
      where e.created_at >= ${from} and e.created_at < ${to}
        ${like === null ? sql`` : sql`and e.title ilike ${like}`}
        ${stateClause}
      order by e.created_at desc
      limit ${DIRECTORY_PAGE_SIZE} offset ${offset}
    `);

    return shape(
      [...rows].map((row) => ({
        id: row.id,
        name: row.name,
        detail: row.organizer ?? "",
        createdAtISO: new Date(row.created_at).toISOString(),
        meta: {
          attending: Number(row.attending),
          costMode: row.cost_mode,
          cancelled: row.cancelled,
          startsAtISO: new Date(row.starts_at).toISOString(),
        },
      })),
      Number(rows[0]?.total ?? 0),
      query.page,
    );
  }

  const rows = await db.execute<{
    id: string;
    name: string;
    owner: string | null;
    created_at: Date;
    members: string;
    events: string;
    total: string;
  }>(sql`
    select
      g.id::text as id,
      g.name,
      p.full_name as owner,
      g.created_at,
      (select count(*) from group_members m
         where m.group_id = g.id and m.status = 'joined')::text as members,
      (select count(*) from events e where e.group_id = g.id)::text as events,
      count(*) over()::text as total
    from groups g
    left join user_profiles p on p.user_id = g.owner_id
    where g.created_at >= ${from} and g.created_at < ${to}
      ${like === null ? sql`` : sql`and g.name ilike ${like}`}
    order by g.created_at desc
    limit ${DIRECTORY_PAGE_SIZE} offset ${offset}
  `);

  return shape(
    [...rows].map((row) => ({
      id: row.id,
      name: row.name,
      detail: row.owner ?? "",
      createdAtISO: new Date(row.created_at).toISOString(),
      meta: { members: Number(row.members), events: Number(row.events) },
    })),
    Number(rows[0]?.total ?? 0),
    query.page,
  );
}

function shape(rows: DirectoryRow[], total: number, page: number): DirectoryPage {
  return { rows, total, page, pages: pageCount(total) };
}
