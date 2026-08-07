"use client";

import { useEffect } from "react";

import { useRouter } from "@tanstack/react-router";

/**
 * The listening half of `src/lib/live.ts`: subscribes to the event's public
 * broadcast topic and re-runs the route's loaders when the server says
 * "changed". Renders nothing — it is mounted for its subscription, the way
 * the pages already mount toasts for their side effects.
 *
 * The supabase client arrives via dynamic import for the same reason the
 * sign-in buttons load it that way: `supabase-js` is a quarter-megabyte
 * gzipped and must never ride the first paint of a WhatsApp-link visitor.
 * Here the import happens in an effect after hydration, off the critical
 * path by construction.
 *
 * Invalidation is debounced. One approval fires one ping, but a burst — an
 * organizer working through a review queue, a claim that also re-syncs
 * payments — would otherwise re-run the loaders once per ping. The trailing
 * 400ms collapse turns any burst into a single re-read of the loader, whose
 * response is authoritative anyway: the ping carries no data, so hearing it
 * five times says nothing that hearing it once did not.
 */
export function LiveEvent({ publicToken }: { publicToken: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
      if (cancelled) return;

      const client = createSupabaseBrowserClient();
      const channel = client
        .channel(`event:${publicToken}`)
        .on("broadcast", { event: "changed" }, () => {
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            void router.invalidate();
          }, 400);
        })
        .subscribe();

      unsubscribe = () => void client.removeChannel(channel);
      // The effect may have been torn down while the import was in flight.
      if (cancelled) unsubscribe();
    })();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      unsubscribe?.();
    };
  }, [publicToken, router]);

  return null;
}
