import { createServerFn } from "@tanstack/react-start";

/**
 * The one door a browser has into the analytics table.
 *
 * It is a door rather than a direct write because a client-reported event is
 * an assertion by an untrusted party: the name is checked against the list of
 * events a browser is allowed to send, the actor is taken from the session
 * rather than from the payload, and the source is stamped `"client"` here
 * regardless of what arrived. A page cannot record a payment.
 *
 * Fire-and-forget at the call site too — nothing awaits this, and it resolves
 * even when the write fails.
 */
export const trackFn = createServerFn({ method: "POST" })
  .validator((data: { name: string; props?: Record<string, string | number | boolean | null> }) => data)
  .handler(async ({ data }) => {
    const [{ isClientEvent }, { trackFromClient }, { getOrganizer }] = await Promise.all([
      import("@/domain/analytics"),
      import("@/lib/analytics"),
      import("@/lib/organizer"),
    ]);

    // An unknown name is dropped rather than recorded. A closed taxonomy that
    // accepts anything a client sends is not closed.
    if (!isClientEvent(data.name)) return { ok: false } as const;

    // From the session, never from the payload. A browser saying whose event
    // this is would make `actor_id` worth nothing.
    const organizer = await getOrganizer();

    trackFromClient(data.name, data.props ?? {}, organizer?.id ?? null);

    return { ok: true } as const;
  });

/**
 * What components call.
 *
 * Swallows its own failure so a blocked request, an offline phone or an ad
 * blocker cannot surface as an error in a page that is otherwise working.
 */
export function trackClient(
  name: string,
  props: Record<string, string | number | boolean | null> = {},
): void {
  void trackFn({ data: { name, props } }).catch(() => {});
}
