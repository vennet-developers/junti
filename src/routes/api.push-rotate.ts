import { createFileRoute } from "@tanstack/react-router";

/**
 * Where a service worker reports that its push subscription was rotated.
 *
 * Browsers occasionally replace a subscription behind the app's back —
 * `pushsubscriptionchange` — and the worker that catches it has no session
 * UI and no way to run a server function. Without this route the device goes
 * silently deaf until its owner happens to re-toggle. A plain POST is the
 * whole fix.
 *
 * **The credential is possession of the DYING endpoint.** The row is looked
 * up by the old endpoint — an unguessable push-service URL that only the
 * browser that owns it (and we) ever held — and rewritten in place, keeping
 * its user. Same trust class as a claim token. No session required, because
 * the worker may fire this while nobody is signed in on any tab; no
 * user-chosen fields are accepted, so the worst a forged call with a guessed
 * endpoint could do is repoint delivery of notifications to itself — which
 * is what already happens if a push service rotates you onto that endpoint.
 */
export const Route = createFileRoute("/api/push-rotate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ z }, { db }, { pushSubscriptions }, { eq }] = await Promise.all([
          import("zod"),
          import("@/db/client"),
          import("@/db/schema"),
          import("drizzle-orm"),
        ]);

        const parsed = z
          .object({
            oldEndpoint: z.string().url().startsWith("https://").max(2000),
            endpoint: z.string().url().startsWith("https://").max(2000),
            p256dh: z.string().min(1).max(512),
            auth: z.string().min(1).max(512),
          })
          .safeParse(await request.json().catch(() => null));

        // 204 either way: a worker cannot show an error to anybody, and a
        // different status for "unknown endpoint" would let a prober tell
        // which endpoints exist.
        if (parsed.success) {
          await db
            .update(pushSubscriptions)
            .set({
              endpoint: parsed.data.endpoint,
              p256dh: parsed.data.p256dh,
              auth: parsed.data.auth,
            })
            .where(eq(pushSubscriptions.endpoint, parsed.data.oldEndpoint))
            .catch(() => {});
        }

        return new Response(null, { status: 204 });
      },
    },
  },
});
