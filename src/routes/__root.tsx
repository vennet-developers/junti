import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import juntiCss from "@/styles/junti.css?url";

import { BRAND_NAME, BRAND_TAGLINE } from "@/config/brand";

/**
 * The document — what `src/app/layout.tsx` was under Next.
 *
 * The stylesheet arrives as ONE link (`junti.css` bundles the whole ordered
 * import list) rather than thirty: the order the tokens require is enforced
 * inside that file once, instead of by the sequence of imports in whichever
 * file happens to be the root today.
 *
 * Still missing, on purpose, until their phases: the header and footer (the
 * components exist but lean on session and preferences — phase 3), the
 * per-request locale and theme on `<html>` (phase 3), and per-route metadata
 * (each route brings its own `head()` in phase 4). What this file must get
 * right today is the shell: fonts, tokens, and a body that Stackmyth styles.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${BRAND_NAME} — ${BRAND_TAGLINE}` },
    ],
    links: [
      { rel: "stylesheet", href: juntiCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      {/* eslint-disable-next-line @next/next/no-head-element --
          Next's rule, firing on a TanStack file. The document really is ours
          to write here; the whole eslint-config-next preset leaves with the
          last Next file in phase 6. */}
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
