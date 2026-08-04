import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";

import { CheckCircleIcon, InfoIcon, TriangleAlertIcon, XCircleIcon, XIcon } from "@stackmyth/icons";
import { Box } from "@stackmyth/layout";
import { Toaster } from "@stackmyth/toast";

import juntiCss from "@/styles/junti.css?url";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { CopyProvider } from "@/components/copy-provider";
import { BRAND_NAME, BRAND_TAGLINE } from "@/config/brand";
import { getCopy, type Locale } from "@/config/copy";
import type { Organizer } from "@/lib/organizer";
import type { Theme } from "@/lib/preferences";

/**
 * Everything the frame needs, in one server round trip.
 *
 * The session is one network revalidation against Supabase per request — the
 * same call every protected route will make, deduplicated by the per-request
 * memo on `getOrganizer`, so the shell asking too costs nothing extra. What
 * it buys is the header behaving like the footer: rendered once, surviving
 * pending states, impossible to forget on the next screen somebody adds.
 */
const getShell = createServerFn({ method: "GET" }).handler(async () => {
  const [{ resolvePreferences }, { getOrganizer }] = await Promise.all([
    import("@/lib/preferences"),
    import("@/lib/organizer"),
  ]);

  const [{ locale, theme }, organizer] = await Promise.all([
    resolvePreferences(),
    getOrganizer(),
  ]);

  return { locale, theme, organizer } as {
    locale: Locale;
    theme: Theme | null;
    organizer: Organizer | null;
  };
});

/**
 * The document — what `src/app/layout.tsx` was under Next, loader included.
 *
 * The loader runs on the server for the first paint and re-runs on
 * `router.invalidate()`, which is how a theme or language change repaints
 * `<html>` without a full reload — the role `revalidatePath("/", "layout")`
 * played before.
 */
export const Route = createRootRoute({
  loader: () => getShell(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${BRAND_NAME} — ${BRAND_TAGLINE}` },
      /*
        Paper and ink, so the browser chrome continues the page instead of
        ending it. Literals, kept in step with --junti-papel by hand — this is
        a metadata string, no custom property can reach it.
      */
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#faf7f2" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#09090b" },
    ],
    links: [
      { rel: "stylesheet", href: juntiCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { locale, theme, organizer } = Route.useLoaderData();

  return (
    <RootDocument locale={locale} theme={theme}>
      <CopyProvider locale={locale}>
        {/* The frame's top edge, mirror of the footer at the bottom. In the
            root so it survives pending states and cannot be forgotten. */}
        <AppHeader organizer={organizer} theme={theme} />

        <Outlet />

        {/* The spacer that puts the footer on the bottom edge of a short
            page: eats the leftover height, collapses to nothing when full. */}
        <Box flexGrow={1} />

        <AppFooter />

        {/*
          One toast host for the whole app. Top, not bottom: every form ends
          in a full-width submit and a bottom toast lands on the control just
          pressed; the offset clears the signed-in header.
        */}
        <Toaster
          position="top-center"
          offset="5rem"
          duration={5000}
          richColors
          maxToasts={3}
          showCloseButton
          icons={{
            success: <CheckCircleIcon aria-hidden="true" />,
            error: <XCircleIcon aria-hidden="true" />,
            warning: <TriangleAlertIcon aria-hidden="true" />,
            info: <InfoIcon aria-hidden="true" />,
            close: <XIcon aria-hidden="true" />,
          }}
        />
      </CopyProvider>
    </RootDocument>
  );
}

function RootDocument({
  children,
  locale,
  theme,
}: {
  children: ReactNode;
  locale: Locale;
  theme: Theme | null;
}) {
  return (
    /*
      `data-mode` is what Stackmyth's palette reads to force an appearance.
      Omitting it is not "no theme" — it is "follow the OS", which
      core.vars.css handles with a `prefers-color-scheme` block. Stamped on
      the server so a dark-mode reader is never flashed a white first paint.
    */
    <html lang={getCopy(locale).intlLocale} data-mode={theme ?? undefined}>
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
