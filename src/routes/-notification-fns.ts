import { createServerFn } from "@tanstack/react-start";

import type { NotificationPage } from "@/lib/notifications";

/**
 * The drawer's three server calls.
 *
 * **The list is not in any loader.** It is fetched when the panel opens and
 * never before, which is the whole reason the root layout carries only a count:
 * a notification list on every page load would be a join and a page of rows for
 * a control most visits never touch.
 *
 * Every one of these resolves the account from the session and scopes on it.
 * Nothing takes a user id from the caller — an inbox is the obvious thing to
 * try reading somebody else's.
 */

const empty: NotificationPage = { items: [], cursor: null };

/** A page of the inbox, newest first. Pass the previous page's cursor for more. */
export const notificationsFn = createServerFn({ method: "GET" })
  .validator((data: { cursor?: string | null } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<NotificationPage> => {
    const [{ getOrganizer }, { getViewerCopy }, { loadNotifications }] = await Promise.all([
      import("@/lib/organizer"),
      import("@/lib/locale"),
      import("@/lib/notifications"),
    ]);

    const organizer = await getOrganizer();
    if (!organizer) return empty;

    const { copy } = await getViewerCopy();

    return loadNotifications(organizer.id, copy, { cursor: data.cursor ?? null });
  });

/**
 * Marks one read, on the way to opening it.
 *
 * Returns nothing worth reading: the caller navigates immediately and the badge
 * catches up on the next loader run. A failure here means an item stays bold,
 * which is a smaller problem than blocking somebody's tap on a write.
 */
export const markNotificationReadFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const [{ getOrganizer }, { markRead }] = await Promise.all([
      import("@/lib/organizer"),
      import("@/lib/notifications"),
    ]);

    const organizer = await getOrganizer();
    if (!organizer) return { ok: false } as const;

    await markRead(organizer.id, data.id);
    return { ok: true } as const;
  });

/** AC-4. Idempotent by construction — see `markAllRead`. */
export const markAllNotificationsReadFn = createServerFn({ method: "POST" }).handler(async () => {
  const [{ getOrganizer }, { markAllRead }] = await Promise.all([
    import("@/lib/organizer"),
    import("@/lib/notifications"),
  ]);

  const organizer = await getOrganizer();
  if (!organizer) return { ok: false, cleared: 0 } as const;

  return { ok: true, cleared: await markAllRead(organizer.id) } as const;
});
