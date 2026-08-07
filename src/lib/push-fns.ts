import { createServerFn } from "@tanstack/react-start";

/**
 * The push channel's three doors, callable from the bell.
 *
 * Server functions are public endpoints, so each write re-checks the session
 * and scopes to it — the subscription saved is the CALLER's, whatever the
 * body claims. The config read needs no auth: a VAPID public key is public by
 * name and by design; withholding it protects nothing.
 */

export const getPushConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
});

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .validator((data: PushSubscriptionInput) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const [{ z }, { getOrganizer }, { saveSubscription }, { getRequest }] = await Promise.all([
      import("zod"),
      import("@/lib/organizer"),
      import("@/lib/push"),
      import("@tanstack/react-start/server"),
    ]);

    const parsed = z
      .object({
        // Push services are https by protocol; refusing anything else keeps a
        // forged subscription from turning the sender into a request proxy.
        endpoint: z.string().url().startsWith("https://").max(2000),
        p256dh: z.string().min(1).max(512),
        auth: z.string().min(1).max(512),
      })
      .safeParse(data);
    if (!parsed.success) return { ok: false };

    const organizer = await getOrganizer();
    if (!organizer) return { ok: false };

    await saveSubscription(
      organizer.id,
      parsed.data,
      getRequest().headers.get("user-agent")?.slice(0, 255) ?? null,
    );

    const { track } = await import("@/lib/analytics");
    track("push_enabled", {}, organizer.id);

    return { ok: true };
  });

export const deletePushSubscriptionFn = createServerFn({ method: "POST" })
  .validator((data: { endpoint: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const [{ getOrganizer }, { deleteSubscription }] = await Promise.all([
      import("@/lib/organizer"),
      import("@/lib/push"),
    ]);

    const organizer = await getOrganizer();
    if (!organizer) return { ok: false };

    await deleteSubscription(organizer.id, String(data.endpoint ?? ""));
    return { ok: true };
  });
