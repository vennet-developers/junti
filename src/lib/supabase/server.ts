import "@/server/assert-server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabasePublishableKey, supabaseUrl } from "@/config/supabase-env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Used ONLY for identity: who is signed in. Application data never goes through
 * it — events, participants and payments stay on Drizzle over Postgres. See
 * DECISIONS.md, "Supabase Auth for identity, Drizzle for data".
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Harmless: src/proxy.ts
          // refreshes the session on the routes that need it.
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
