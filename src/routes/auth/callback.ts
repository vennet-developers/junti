import type { EmailOtpType, User } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

import { ROUTES, signInPath } from "@/config/routes";

/**
 * Where Google and the email links land — the port of
 * `src/app/auth/callback/route.ts`, logic untouched.
 *
 * Supabase hands back the session in one of two shapes, and a callback that
 * only understands one silently fails on the other:
 *
 * 1. **`?code=`** — the PKCE flow, when the sign-in STARTED in this browser.
 * 2. **`?token_hash=&type=`** — a link verified without a stored verifier: an
 *    admin-generated link, or an email opened somewhere else. `verifyOtp`.
 *
 * The third shape, `#access_token=`, never reaches any server — fragments —
 * and belongs to the implicit flow this project does not use.
 *
 * The redirect is a plain 302 `Response`; the session cookies ride on it
 * because `createSupabaseServerClient`'s `setAll` writes through Start's
 * response context, which is merged into whatever the handler returns.
 */
export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        /*
          Server modules arrive by dynamic import because this FILE ships to
          the browser: a route is part of the client route tree even when all
          it defines is server handlers, and top-level imports here dragged
          the preferences module — and behind it the database client — into
          the client bundle. The tripwire caught it on first render.
        */
        const [{ applyStoredPreferences }, { ensureProfile }, { createSupabaseServerClient }] =
          await Promise.all([
            import("@/lib/preferences"),
            import("@/lib/profile"),
            import("@/lib/supabase/server"),
          ]);

        const { searchParams, origin } = new URL(request.url);
        const code = searchParams.get("code");
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type") as EmailOtpType | null;
        const next = searchParams.get("next");

        // Relative paths only — an absolute `next` would be an open redirect.
        const destination =
          next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.myEvents;

        const redirect = (path: string) =>
          new Response(null, { status: 302, headers: { Location: `${origin}${path}` } });

        /** Back to sign-in, saying why and remembering where they were going. */
        const failed = (reason: "browser" | "link") => {
          const back = signInPath(destination);
          return redirect(`${back}${back.includes("?") ? "&" : "?"}error=${reason}`);
        };

        /**
         * Where a freshly signed-in person lands: where they were going,
         * unless we know nothing about them — an emailed link carries an
         * address and no name, so they detour through onboarding with their
         * destination carried along.
         */
        async function landing(user: User): Promise<string> {
          await applyStoredPreferences(user.id);

          const { needsOnboarding } = await ensureProfile(user);
          if (!needsOnboarding) return destination;

          return `${ROUTES.onboarding}?next=${encodeURIComponent(destination)}`;
        }

        const supabase = await createSupabaseServerClient();

        if (code) {
          const { error, data } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            return redirect(data.user ? await landing(data.user) : destination);
          }

          // `bad_code_verifier` is the one failure with an instruction
          // attached: the link was opened somewhere other than where the
          // sign-in started. "Try again" does not help; "open it there" does.
          return failed(error.code === "bad_code_verifier" ? "browser" : "link");
        }

        if (tokenHash && type) {
          const { error, data } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (!error) {
            return redirect(data.user ? await landing(data.user) : destination);
          }
        }

        return failed("link");
      },
    },
  },
});
