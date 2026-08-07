import "@/server/assert-server";

import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { Copy } from "@/config/copy";
import { db } from "@/db/client";
import { events, notifications } from "@/db/schema";
import {
  PAGE_SIZE,
  UNREAD_CAP,
  deepLink,
  relativeParts,
  sentenceFor,
  type NotificationType,
} from "@/domain/notifications";

/**
 * Writing the inbox, and reading it back as sentences.
 *
 * The write half is called from the same places that enqueue email, which is
 * the card's own guidance and the only way the two channels can be made to
 * agree: one domain change, one call, both outputs. The read half joins the
 * event back in and builds every string, because the row deliberately stores
 * none — see the table's note in `schema.ts`.
 */

export interface NotificationInput {
  /** Who is told. */
  userId: string;
  type: NotificationType;
  eventId: string;
  payload?: Record<string, unknown>;
}

/**
 * Records notifications, minus the ones nobody should get.
 *
 * **Nobody is told about their own action** — the card's second piece of
 * guidance, and enforced here rather than at each call site so it cannot be
 * forgotten on the sixth one. An organizer who is also on their own roster
 * would otherwise be told that they answered, that they paid, and that they
 * changed the thing they just changed.
 *
 * Never throws. These are notes ABOUT things that already happened, exactly
 * like `notify()`, and the same rule applies: an RSVP is not undone because
 * writing a row about it failed.
 */
export async function record(
  inputs: NotificationInput[],
  /** The person who caused it. Their own copy is dropped. */
  actorId: string | null,
): Promise<number> {
  const rows = inputs
    .filter((input) => input.userId !== actorId)
    .map((input) => ({
      id: uuidv7(),
      userId: input.userId,
      type: input.type,
      eventId: input.eventId,
      payload: input.payload ?? {},
    }));

  if (rows.length === 0) return 0;

  try {
    await db.insert(notifications).values(rows);

    /*
      The push mirror, fed the same filtered inputs the inbox just stored —
      one call site, both channels, which is the only way a lock screen and a
      bell can be made to agree. Awaited (a serverless runtime may not finish
      unawaited work) but wrapped in its own silence: push failing must not
      report the inbox write as failed.
    */
    try {
      const { pushRecorded } = await import("@/lib/push");
      await pushRecorded(inputs.filter((input) => input.userId !== actorId));
    } catch {
      // Best-effort by design — see src/lib/push.ts.
    }

    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * How many are waiting, counted no further than it matters.
 *
 * The badge caps at "9+", so counting past ten is arithmetic nobody reads. The
 * subquery's `limit` is what makes this a bounded scan on the partial unread
 * index rather than a full count that grows with an account's history — and
 * this runs in the root loader, on every page, for every signed-in request.
 */
export async function unreadCount(userId: string): Promise<number> {
  const capped = db
    .select({ one: sql<number>`1` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .limit(UNREAD_CAP + 1)
    .as("capped");

  const [row] = await db.select({ total: sql<string>`count(*)` }).from(capped);

  return Number(row?.total ?? 0);
}

/** One row of the drawer, with every string already built. */
export interface NotificationView {
  id: string;
  /** What happened, in the reader's language. */
  text: string;
  /** Which event it happened on. */
  eventTitle: string;
  /** "hace 5 minutos". */
  when: string;
  href: string;
  read: boolean;
}

export interface NotificationPage {
  items: NotificationView[];
  /** The id to ask for the next page with, or null at the end. */
  cursor: string | null;
}

/**
 * A page of somebody's inbox, newest first — AC-2 and AC-7.
 *
 * **Keyset, not offset.** The cursor is the last id seen and ids are uuidv7, so
 * "the next page" is `id < cursor` against the primary key. Offset pagination
 * would have re-read everything above it on every page and, worse, silently
 * skipped a row whenever a new notification arrived while somebody was reading
 * — which for an inbox is the one bug nobody would ever report, because the
 * thing they never saw is the thing they never saw.
 *
 * One extra row is fetched and dropped: that is how "is there more" is answered
 * without a second count.
 */
export async function loadNotifications(
  userId: string,
  copy: Copy,
  options: { cursor?: string | null; now?: Date } = {},
): Promise<NotificationPage> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      eventTitle: events.title,
      publicToken: events.publicToken,
      organizerToken: events.organizerToken,
    })
    .from(notifications)
    .innerJoin(events, eq(events.id, notifications.eventId))
    .where(
      and(
        eq(notifications.userId, userId),
        options.cursor ? lt(notifications.id, options.cursor) : undefined,
      ),
    )
    .orderBy(desc(notifications.id))
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);
  const now = options.now ?? new Date();

  const relative = new Intl.RelativeTimeFormat(copy.intlLocale, { numeric: "auto" });

  const items = page.map((row): NotificationView => {
    const type = row.type as NotificationType;
    const { value, unit } = relativeParts(row.createdAt.getTime(), now.getTime());

    return {
      id: row.id,
      text: sentenceFor(type, row.payload as Record<string, unknown>, copy),
      eventTitle: row.eventTitle,
      when: relative.format(value, unit),
      href: deepLink(type, {
        publicToken: row.publicToken,
        organizerToken: row.organizerToken,
      }),
      read: row.readAt !== null,
    };
  });

  return {
    items,
    // A cursor only when there is genuinely something behind it, so the "see
    // more" control cannot appear over an empty next page.
    cursor: rows.length > PAGE_SIZE ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/**
 * Marks one as read — AC-3 and AC-4's idempotency.
 *
 * Scoped by `user_id` in the statement itself rather than checked before it, so
 * an id belonging to somebody else's inbox updates nothing instead of being
 * looked up and then written to. `read_at is null` in the same predicate is
 * what makes a second call a no-op rather than a fresh timestamp: re-reading
 * something must not change when it was first read.
 */
export async function markRead(userId: string, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );
}

/** The same, for everything waiting. Returns how many were actually open. */
export async function markAllRead(userId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });

  return updated.length;
}
