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
 * **The matcher is deliberately narrow, and the early return narrows it
 * further.** COSTS.md commits to staying inside the free tier, and every
 * refresh is a round trip to Supabase.
 *
 * The event page had to be added once signed-in people could join it in one tap
 * and prove policies: without a refresh there, an organizer whose access token
 * had expired would simply look signed out, and the one-tap button would not
 * appear. But that page is the one a whole WhatsApp group opens at once, and
 * almost none of them have an account.
 *
 * Hence `hasSessionCookie`: no Supabase cookie means there is no session to
 * refresh, so the request returns untouched without contacting anything. Anyone
 * signed in pays for the refresh; everybody else pays for a map lookup.
 */

/**
 * Supabase names its auth cookies `sb-<project-ref>-auth-token`, possibly with
 * a `.0`/`.1` suffix when the token is chunked. Matching the prefix rather than
 * an exact name survives both the chunking and a change of project.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
}

export async function proxy(request: NextRequest) {
  if (!hasSessionCookie(request)) {
    return NextResponse.next({ request });
  }

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
     *   /mis-eventos      the history, requires a session
     *   /entrar           the sign-in page, redirects away when already in
     *   /auth/...         the OAuth / magic-link callback
     *   /new              so a signed-in creator gets attributed
     *   /e/...            one-tap joining and policy submissions
     *
     * Not matched, on purpose: /api and all static assets.
     */
    "/mis-eventos/:path*",
    "/entrar",
    "/auth/:path*",
    "/new",
    "/e/:path*",
  ],
};
