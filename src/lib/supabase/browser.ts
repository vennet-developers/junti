"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabasePublishableKey, supabaseUrl } from "@/config/supabase-env";

/**
 * Supabase client for the browser. Used to START a sign-in flow (Google
 * redirect, email magic link), to sign out, and to LISTEN on an event's
 * broadcast topic (`src/components/live-event.tsx`) — never to read data.
 *
 * **Import this module dynamically, always.** `createBrowserClient` pulls the
 * whole `supabase-js` surface behind it — auth, postgrest, storage, realtime
 * and phoenix — and this app uses exactly one of those, which is what the line
 * above has always said. Statically imported it put roughly a quarter of a
 * megabyte, gzipped, on the critical path of every reader: including the
 * majority who arrive from a WhatsApp link, answer an event and never sign in
 * at all.
 *
 * The call sites are click handlers or post-hydration effects, so `await
 * import()` inside them costs nothing a person can perceive — and the sign-in
 * form warms this module on mount, next to the send-email warm-up it already
 * had.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
