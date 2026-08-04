import { createMiddleware, createStart } from "@tanstack/react-start";

/**
 * Global request middleware — the successor of `src/proxy.ts`.
 *
 * NOTE: this module is loaded by both the client and the server bundle, so
 * every server-only import below lives inside a `.server()` body, where the
 * Start compiler strips it from the client build. Top-level would leak
 * `node:async_hooks` and the Supabase server client into the browser — the
 * exact class of accident `scripts/check-client-bundle.mjs` exists to catch.
 */

/**
 * Opens the per-request memo store, so `memoPerRequest` (and through it
 * `getOrganizer`) deduplicates within a request the way `React.cache` did
 * under Next. Outermost on purpose: everything else runs inside the scope.
 */
const requestMemoMiddleware = createMiddleware().server(async ({ next }) => {
  const { runWithRequestMemo } = await import("@/server/request-memo");
  return runWithRequestMemo(() => next());
});

/**
 * Refreshes the Supabase session cookie — everything `src/proxy.ts` did,
 * with the same two guardrails carried over on purpose:
 *
 * - **No `sb-` cookie, no work.** COSTS.md commits to the free tier and every
 *   refresh is a round trip to Supabase. The event page is opened by whole
 *   WhatsApp groups of people with no account; they pay for a string scan.
 * - **Dead sessions are evicted here.** Cookies naming a deleted account never
 *   expire on their own — `getUser()` just keeps failing identically and the
 *   person sees a sign-in form that refuses to work. This is the one place in
 *   the request path that can both detect that and delete the cookies.
 *   Restraint lives in `isDeadSession`: clearing on any failure would turn a
 *   brief outage into everybody signed out at once.
 *
 * The Next version also had a path matcher; here the middleware only runs on
 * requests Start handles (documents, server functions, server routes), and
 * the api webhooks guard themselves, so the cookie check is the only gate
 * that still matters.
 */
const sessionMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!cookieHeader.includes("sb-")) return next();

  const [{ createServerClient }, { getCookies, setCookie, deleteCookie }, config, session] =
    await Promise.all([
      import("@supabase/ssr"),
      import("@tanstack/react-start/server"),
      import("@/config/supabase-env"),
      import("@/lib/supabase/session"),
    ]);

  const supabase = createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh. Do not remove it.
  const { error } = await supabase.auth.getUser();

  if (session.isDeadSession(error)) {
    for (const name of Object.keys(getCookies())) {
      if (name.startsWith("sb-")) deleteCookie(name);
    }
  }

  return next();
});

/** Auto-discovered by the Vite plugin. Order matters: outermost first. */
export const startInstance = createStart(() => ({
  requestMiddleware: [requestMemoMiddleware, sessionMiddleware],
}));
