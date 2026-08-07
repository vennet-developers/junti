import "@/server/assert-server";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { events, pushSubscriptions, userPreferences } from "@/db/schema";
import { getCopy, isLocale, DEFAULT_LOCALE, type Locale } from "@/config/copy";
import { pushPayload, type NotificationType } from "@/domain/notifications";
import type { NotificationInput } from "@/lib/notifications";

/**
 * The push channel: the inbox's rows, delivered to the devices that asked.
 *
 * **A mirror, never a source.** This module receives exactly the inputs
 * `record()` just wrote — same types, same payloads, same actor filter
 * already applied — and pushes the same sentence `sentenceFor` builds for the
 * drawer, in each RECIPIENT's language. Nothing is pushed that the inbox does
 * not hold, which is what keeps the lock screen and the bell describing one
 * world.
 *
 * **Failures are swallowed, deletions are honored.** Like `notify()`: these
 * are notes about things that already happened, and an RSVP must not fail
 * because Apple's push service had a bad minute. The one response that IS
 * acted on is 404/410 — the protocol's way of saying "this device
 * unsubscribed" — which deletes the row. The next send is the sweep.
 *
 * VAPID keys come from the environment; when they are missing the module is
 * silently inert, so a deploy without the secrets degrades to "no push"
 * rather than an error on every RSVP.
 */

interface Sendable {
  userId: string;
  type: NotificationType;
  eventId: string;
  payload: Record<string, unknown>;
}

export async function pushRecorded(inputs: NotificationInput[]): Promise<void> {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return;

    const sendables: Sendable[] = inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      eventId: input.eventId,
      payload: input.payload ?? {},
    }));

    const userIds = [...new Set(sendables.map((s) => s.userId))];
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    if (subscriptions.length === 0) return;

    /*
      The language is the RECIPIENT's stored preference, not the sender's
      request: a push may fire from a background job with no reader attached,
      and the phone it lands on belongs to somebody with a known choice.
    */
    const locales = new Map<string, Locale>();
    const preferenceRows = await db
      .select({ userId: userPreferences.userId, locale: userPreferences.locale })
      .from(userPreferences)
      .where(inArray(userPreferences.userId, userIds));
    for (const row of preferenceRows) {
      if (row.locale && isLocale(row.locale)) locales.set(row.userId, row.locale);
    }

    const eventIds = [...new Set(sendables.map((s) => s.eventId))];
    const eventRows = await db
      .select({
        id: events.id,
        title: events.title,
        publicToken: events.publicToken,
        organizerToken: events.organizerToken,
      })
      .from(events)
      .where(inArray(events.id, eventIds));
    const eventsById = new Map(eventRows.map((row) => [row.id, row]));

    const webpush = await import("web-push");
    webpush.default.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:hello@vennet.dev",
      publicKey,
      privateKey,
    );

    const bySubscriber = new Map<string, typeof subscriptions>();
    for (const subscription of subscriptions) {
      const list = bySubscriber.get(subscription.userId) ?? [];
      list.push(subscription);
      bySubscriber.set(subscription.userId, list);
    }

    const dead: string[] = [];

    await Promise.allSettled(
      sendables.flatMap((sendable) => {
        const event = eventsById.get(sendable.eventId);
        const devices = bySubscriber.get(sendable.userId) ?? [];
        if (!event || devices.length === 0) return [];

        const copy = getCopy(locales.get(sendable.userId) ?? DEFAULT_LOCALE);
        const body = JSON.stringify(
          pushPayload(sendable.type, sendable.payload, event.title, event, copy),
        );

        return devices.map((device) =>
          webpush.default
            .sendNotification(
              {
                endpoint: device.endpoint,
                keys: { p256dh: device.p256dh, auth: device.auth },
              },
              body,
              // An hour of retry at the push service, then drop: a "someone
              // answered" that arrives tomorrow is noise about old news.
              { TTL: 3600 },
            )
            .catch((error: { statusCode?: number }) => {
              if (error?.statusCode === 404 || error?.statusCode === 410) {
                dead.push(device.endpoint);
              }
            }),
        );
      }),
    );

    if (dead.length > 0) {
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.endpoint, dead));
    }
  } catch {
    // The domain change this describes already happened; push is best-effort.
  }
}

/** Saves (or re-owns) a device's subscription for the signed-in account. */
export async function saveSubscription(
  userId: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
  userAgent: string | null,
): Promise<void> {
  const { uuidv7 } = await import("uuidv7");

  await db
    .insert(pushSubscriptions)
    .values({
      id: uuidv7(),
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      /*
        Ownership follows the CURRENT session: the same browser subscribing
        under a new sign-in must start feeding the new account, not keep
        pushing the previous person's notifications at this phone.
      */
      set: {
        userId,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent,
      },
    });
}

/** Removes one device. Scoped to the owner in the predicate itself. */
export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}
