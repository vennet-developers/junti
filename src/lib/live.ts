import "@/server/assert-server";

import { supabasePublishableKey, supabaseUrl } from "@/config/supabase-env";

/**
 * The realtime nudge: "this event changed, re-read it".
 *
 * One broadcast per successful mutation, over Supabase Realtime's HTTP API,
 * onto the topic `event:{publicToken}`. Every open page for that event —
 * the organizer watching the roster, a participant staring at "Pendiente"
 * after sending their comprobante — hears it and re-runs its loaders. Nobody
 * refreshes anything by hand; approval shows up on the other person's screen
 * by itself.
 *
 * The payload is EMPTY, deliberately. Channels here are public (this project
 * keeps authorization in tokens and server code, not in RLS — see
 * DECISIONS.md), so nothing may travel on them that the topic name alone
 * does not already grant: possession of the public token is the right to
 * read the event page, and all a listener learns is "changed". The data
 * itself still crosses only the loader, server-side checks intact. This is
 * also why `postgres_changes` was rejected — with RLS disabled it would
 * stream actual rows to anyone holding the publishable key.
 *
 * Best-effort by contract: awaited so the send survives the serverless
 * instance, but capped at two seconds and silent on failure. A mutation that
 * saved must report success even when the nudge did not go out — the pages
 * still converge on their next natural load, exactly as before this existed.
 */
export async function pingEvent(publicToken: string): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic: `event:${publicToken}`, event: "changed", payload: {} }],
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // The nudge is a courtesy, never a dependency.
  }
}
