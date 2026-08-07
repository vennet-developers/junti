import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useMatches,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";

import { CheckCircleIcon, InfoIcon, TriangleAlertIcon, XCircleIcon, XIcon } from "@stackmyth/icons";
import { Box } from "@stackmyth/layout";
import { Toaster } from "@stackmyth/toast";

import juntiCss from "@/styles/junti.css?url";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { CopyProvider } from "@/components/copy-provider";
import { previewModeOf } from "@/domain/preview";
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

  /*
    The COUNT, and deliberately not the list.

    This runs on every page, so what it costs matters: one bounded scan on the
    partial unread index, capped at ten because the badge stops counting there
    anyway. The rows themselves are fetched when somebody opens the panel — see
    `NotificationBell` — because loading twenty of them into every screen to
    render a number would be paying for the whole feature on every navigation.

    Nothing for a visitor with no session: there is no inbox to count.
  */
  const unread = organizer
    ? await import("@/lib/notifications").then((module) => module.unreadCount(organizer.id))
    : 0;

  /*
    Whether this session is the product's owner — a boolean, never the id.
    It only unlocks a menu entry to /funnel, whose loader re-checks the same
    fact server-side; the flag is a signpost, not the gate.
  */
  const isOwner =
    organizer !== null &&
    Boolean(process.env.ANALYTICS_OWNER_ID) &&
    organizer.id === process.env.ANALYTICS_OWNER_ID;

  return { locale, theme, organizer, unread, isOwner } as {
    locale: Locale;
    theme: Theme | null;
    organizer: Organizer | null;
    unread: number;
    isOwner: boolean;
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
      /*
        Next generated these three tags from files inside src/app; the files
        moved to /public with the migration and the tags are written out here.
      */
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { locale, theme, organizer, unread, isOwner } = Route.useLoaderData();

  /*
    The shell, when the page below it is being read through a stranger's eyes.

    Without this the preview stopped at the page: the body rendered as a
    signed-out visitor would see it and the bar above it still carried the
    organizer's avatar and their notification bell — the one place the preview
    was not faithful, and a conspicuous one, because "what does somebody with
    no account see" is most of the reason to look.

    Read off the loader payload rather than off `?as=stranger` in the URL. The
    loader is where ownership was checked, so a stranger parameter from
    somebody who does not own the event never becomes a `preview` value and
    cannot reach the chrome — see `previewModeOf`. The alternative, matching on
    the search param up here, would have let any URL blank out any reader's
    own header on any route.

    Only `stranger`. A guest IS signed in, and a header showing an account is
    exactly what they see; blanking it there would make the preview wrong in
    the other direction.
  */
  const matches = useMatches();
  const asStranger = matches.some((match) => previewModeOf(match.loaderData) === "stranger");

  return (
    <RootDocument locale={locale} theme={theme}>
      <CopyProvider locale={locale}>
        {/* The frame's top edge, mirror of the footer at the bottom. In the
            root so it survives pending states and cannot be forgotten. */}
        <AppHeader
          organizer={asStranger ? null : organizer}
          theme={theme}
          /* Belt and braces: `unread` is already 0 without a session, and the
             bell only renders with an organizer. Passing 0 means the two
             cannot disagree if either of those ever changes. */
          unread={asStranger ? 0 : unread}
          /* The stranger preview must not leak the one menu entry that
             proves whose account this is. */
          isOwner={asStranger ? false : isOwner}
        />

        {/* The one <main> landmark, around every page: a screen reader's
            "skip to content" needs somewhere to land, and this is the root
            that guarantees the landmark on screens nobody remembers to add
            it to. */}
        <Box as="main">
          <Outlet />
        </Box>

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
