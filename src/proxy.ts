import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabasePublishableKey, supabaseUrl } from "@/config/supabase-env";

/**
 * Refreshes the Supabase session cookie.
 *
 * Server Components cannot set cookies, so a session that expires mid-visit
 * would silently sign the organizer out. This runs before the request reaches
 * the route and writes the refreshed cookie back.
 *
 * In Next.js 16 this file is `proxy.ts`, not `middleware.ts` — the convention
 * was renamed, and `proxy` always runs on the Node runtime (no edge).
 *
 * **The matcher is deliberately narrow.** COSTS.md commits to staying inside
 * the free tier, and every matched request is a function invocation. Only the
 * organizer's own surfaces need a session; the participant page — the one that
 * gets a whole WhatsApp group at once — is excluded and stays untouched.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh. Do not remove it.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Organizer surfaces only:
     *   /mis-eventos      the history, requires a session
     *   /entrar           the sign-in page, redirects away when already in
     *   /auth/...         the OAuth / magic-link callback
     *   /new              so a signed-in creator gets attributed
     *
     * Not matched, on purpose: /e/<token> and everything under it, /api, and
     * all static assets.
     */
    "/mis-eventos/:path*",
    "/entrar",
    "/auth/:path*",
    "/new",
  ],
};
