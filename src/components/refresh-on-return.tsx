"use client";

import { useEffect } from "react";

import { useRouter } from "@tanstack/react-router";

/**
 * Re-runs the loaders when the app comes back to the foreground.
 *
 * Installed to the home screen, this app has no reload button and no address
 * bar — Ivan's workaround was killing it and opening it again. Meanwhile the
 * page most likely CHANGED precisely while it was in the background: iOS
 * freezes the tab, the realtime websocket dies with it, and whatever pings
 * fired in between were heard by nobody. So the moment the document becomes
 * visible again, invalidate. `LiveEvent` reconnects on its own; this covers
 * the gap between freeze and reconnection, and every page that has no
 * realtime channel at all.
 *
 * `visibilitychange` rather than `focus`: focus fires on every tap into the
 * window and would refetch constantly; visibility flips only when the app
 * actually leaves and returns. Renders nothing; mounted once in the root.
 */
export function RefreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void router.invalidate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
