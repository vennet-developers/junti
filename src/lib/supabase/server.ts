import "@/server/assert-server";

import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";

import { supabasePublishableKey, supabaseUrl } from "@/config/supabase-env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Used ONLY for identity: who is signed in. Application data never goes through
 * it — events, participants and payments stay on Drizzle over Postgres. See
 * DECISIONS.md, "Supabase Auth for identity, Drizzle for data".
 */
export async function createSupabaseServerClient() {
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        // No try/catch any more: unlike a Server Component, every server
        // context here (middleware, loader, server function, route handler)
        // may write response headers, so a refreshed session cookie always
        // makes it out.
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options);
        }
      },
    },
  });
}

/**
 * The signed-in organizer, or null.
 *
 * Uses `getUser()`, not `getSession()`. `getSession()` reads the cookie without
 * verifying it, so a forged cookie would look like a valid session; `getUser()`
 * revalidates against Supabase. Identity decides who may manage an event, so it
 * has to be the trustworthy one.
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
