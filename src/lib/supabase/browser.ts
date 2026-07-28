"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabasePublishableKey, supabaseUrl } from "@/config/supabase-env";

/**
 * Supabase client for the browser. Only ever used to START a sign-in flow
 * (Google redirect, email magic link) and to sign out — never to read data.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
