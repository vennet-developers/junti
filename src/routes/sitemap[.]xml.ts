import { createFileRoute } from "@tanstack/react-router";

/**
 * The two pages worth indexing.
 *
 * A sitemap for a product whose entire surface is private is a short document,
 * and that is the correct length rather than an oversight: an event page is
 * behind a token somebody shared in a chat, and listing it here would be
 * publishing the guest list. The landing explains what this is; the privacy
 * notice is a document people are entitled to find without an account.
 *
 * Absolute URLs are required by the sitemap spec, and they come from the
 * request rather than an environment variable so a preview deployment does not
 * advertise production's domain.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [{ origin }, { ROUTES }] = await Promise.all([
          import("@/lib/urls"),
          import("@/config/routes"),
        ]);

        const base = await origin();

        const pages: { path: string; priority: string; changefreq: string }[] = [
          { path: ROUTES.home, priority: "1.0", changefreq: "weekly" },
          { path: ROUTES.privacy, priority: "0.3", changefreq: "yearly" },
        ];

        const body =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          pages
            .map(
              (page) =>
                `  <url>\n` +
                `    <loc>${base}${page.path === "/" ? "" : page.path}/</loc>\n` +
                `    <changefreq>${page.changefreq}</changefreq>\n` +
                `    <priority>${page.priority}</priority>\n` +
                `  </url>`,
            )
            .join("\n") +
          "\n</urlset>\n";

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
