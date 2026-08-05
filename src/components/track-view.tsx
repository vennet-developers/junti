"use client";

import { useEffect, useRef } from "react";

import { trackClient } from "@/lib/track-client";

/**
 * Records that a page was seen, exactly once.
 *
 * A component rather than a hook so it can be dropped into a server-rendered
 * page without turning that page into a client component — the island is this
 * span-less element and nothing else.
 *
 * **Once** is the whole implementation problem. React runs effects twice in
 * development's strict mode, a router can re-render on a search-param change,
 * and either would double every number in the funnel. The ref is checked and
 * set synchronously, so the second run has nothing to do.
 */
export function TrackView({
  name,
  props,
}: {
  name: string;
  props?: Record<string, string | number | boolean | null>;
}) {
  const fired = useRef(false);

  // `props` is an object literal at every call site, so a new identity on each
  // render. Depending on it would refire on any parent render; the ref is what
  // makes the dependency list safe to leave narrow.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackClient(name, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return null;
}
