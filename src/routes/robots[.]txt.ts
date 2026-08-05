import { createFileRoute } from "@tanstack/react-router";

/**
 * What a crawler may look at, which is almost nothing.
 *
 * **Two pages in this app are public: the landing and the privacy notice.**
 * Everything else is somebody's event behind an unguessable token, somebody's
 * group behind another one, or a screen that requires an account — and every
 * one of those already carries `noindex` in its own `head`. This file is the
 * belt to that pair of braces, and it exists because a crawler that follows a
 * shared event link would otherwise put a roster of real names into a search
 * result.
 *
 * Written as a route rather than a static file so the sitemap URL can be
 * absolute and correct on localhost, on a preview deployment and in
 * production without an environment variable to keep in sync — the same
 * reasoning as `origin()`.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { origin } = await import("@/lib/urls");
        const base = await origin();

        const body = [
          "User-agent: *",
          // Allow-list by omission would be wrong here: the default is allow,
          // so every private prefix has to be named.
          "Disallow: /e/",
          "Disallow: /g/",
          "Disallow: /groups/",
          "Disallow: /my-events",
          "Disallow: /new",
          "Disallow: /profile",
          "Disallow: /messages",
          "Disallow: /approvals",
          "Disallow: /onboarding",
          "Disallow: /sign-in",
          "Disallow: /unsubscribe",
          "Disallow: /funnel",
          "Disallow: /api/",
          "Disallow: /auth/",
          "",
          `Sitemap: ${base}/sitemap.xml`,
          "",
        ].join("\n");

        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            // A day. This changes when routes do, which is rarely, and a stale
            // copy for a few hours costs nothing.
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
