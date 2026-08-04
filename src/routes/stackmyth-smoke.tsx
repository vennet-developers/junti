import { createFileRoute } from "@tanstack/react-router";

import { SmokeClient } from "./-smoke-client";

/**
 * Throwaway integration check for the Stackmyth UI layer.
 *
 * Build order step 2: prove the stack compiles, themes, and lays out correctly
 * at 390px *before* any product code depends on it. Finding out on step 8 that
 * the component library doesn't integrate is the expensive failure mode.
 *
 * Kept rather than deleted: it is the cheapest regression check that the UI
 * layer still integrates after a Stackmyth bump. It is noindex'd and linked
 * from nowhere. Delete this file and `-smoke-client.tsx` to remove it.
 *
 * No loader — the title is a literal, and the whole page is client-side
 * fixtures, so there is nothing for a server function to fetch.
 */
export const Route = createFileRoute("/stackmyth-smoke")({
  head: () => ({
    meta: [{ title: "Stackmyth smoke test" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SmokeClient,
});
