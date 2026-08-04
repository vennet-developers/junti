"use client";

import { useEffect } from "react";

import { useRouter } from "@tanstack/react-router";

import { detectTimeZone } from "@/lib/time-zones";

/**
 * Teaches the server which zone this device is in, once.
 *
 * The server cannot detect a timezone — asking `Intl` there returns the
 * server's own, which is UTC on Vercel and shipped as a real bug once already.
 * So the browser writes it into a cookie the first time somebody arrives, and
 * every render after that is correct server-side with no flash and no
 * client-side re-formatting of every date on the page.
 *
 * Renders nothing. Does nothing at all on the second visit, or when the reader
 * has set a zone in their profile — `hasPreference` covers both, because both
 * end up in the same cookie.
 *
 * The `router.refresh()` is the honest cost: a first-time visitor renders once
 * in the event's zone and then once more in their own. Better than the
 * alternatives, which are a flash of re-formatted times on every load, or
 * silently showing everyone the wrong clock.
 */
export function TimeZoneSync({ hasPreference }: { hasPreference: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (hasPreference) return;

    const detected = detectTimeZone();

    // Not httpOnly by design, so the client can set it without a round trip
    // to a server action. `SameSite=Lax` matches how it is written elsewhere.
    document.cookie = `tz=${encodeURIComponent(detected)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    void router.invalidate();
  }, [hasPreference, router]);

  return null;
}
