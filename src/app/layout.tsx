import type { Metadata, Viewport } from "next";

// ── Stackmyth ────────────────────────────────────────────────────────────────
// One import per package: since 0.22.0 every `<name>.css` inlines its own
// tokens (`<name>.vars.css`) at build time, so the old failure mode — rules
// without variables, rendering a page with correct colors and zero spacing —
// is gone at the source. This file used to carry thirty extra `*.vars.css`
// imports as the workaround; see STACKMYTH-GAPS.md #1 for the history.
//
// Order still matters for the two that remain split on purpose:
// `core.vars.css` first (the 278 global tokens every package resolves
// against — core has no rules file, only tokens), then the self-hosted font
// (sets --sm-font-family), then the per-package styles.
//
// The default palette in core.vars.css (no `data-theme` attribute) is the
// neutral one and already ships a `prefers-color-scheme: dark` block, so light
// and dark both work with zero configuration and zero network requests.
// See DECISIONS.md — "No Stackmyth theme file".
import "@stackmyth/core/core.vars.css";

/*
  The brand's own faces, replacing the Geist import that used to sit here.
  Geist is gone rather than overridden: nothing renders in it any more, and
  leaving the import would ship a font nobody sees.
*/
import "./brand-fonts.css";

import "@stackmyth/layout/layout.css";
import "@stackmyth/text/text.css";
import "@stackmyth/breadcrumb/breadcrumb.css";
import "@stackmyth/button/button.css";
import "@stackmyth/input/input.css";
import "@stackmyth/input-group/input-group.css";
import "@stackmyth/textarea/textarea.css";
import "@stackmyth/label/label.css";
import "@stackmyth/field/field.css";
import "@stackmyth/select/select.css";
import "@stackmyth/combobox/combobox.css";
import "@stackmyth/radio-group/radio-group.css";
import "@stackmyth/switch/switch.css";
import "@stackmyth/checkbox/checkbox.css";
import "@stackmyth/file-upload/file-upload.css";
import "@stackmyth/card/card.css";
import "@stackmyth/badge/badge.css";
import "@stackmyth/alert/alert.css";
import "@stackmyth/dialog/dialog.css";
import "@stackmyth/tabs/tabs.css";
import "@stackmyth/toggle/toggle.css";
import "@stackmyth/toast/toast.css";
import "@stackmyth/list-item/list-item.css";
import "@stackmyth/empty-state/empty-state.css";
import "@stackmyth/stat/stat.css";
import "@stackmyth/progress/progress.css";
import "@stackmyth/spinner/spinner.css";
import "@stackmyth/skeleton/skeleton.css";
import "@stackmyth/accordion/accordion.css";
import "@stackmyth/avatar/avatar.css";
import "@stackmyth/popover/popover.css";
import "@stackmyth/calendar/calendar.css";
import "@stackmyth/date-picker/date-picker.css";
import "@stackmyth/time-picker/time-picker.css";
import "@stackmyth/form/form.css";

/*
  The brand theme goes AFTER every package stylesheet, not next to core's.

  Each package inlines its own `--sm-<component>-*` tokens in a layer of its
  own, and none of them redefines a global token — verified, not assumed — so
  next to core would work today. Last is where it keeps working: a package that
  someday ships a global default cannot land on top of the identity from here.
*/
import "./brand-theme.css";
import "./brand-marks.css";

import "./globals.css";

import { CheckCircleIcon, InfoIcon, TriangleAlertIcon, XCircleIcon, XIcon } from "@stackmyth/icons";
import { Toaster } from "@stackmyth/toast";

import { CopyProvider } from "@/components/copy-provider";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/config/brand";
import { getCopy } from "@/config/copy";
import { getViewerCopy } from "@/lib/locale";
import { resolvePreferences } from "@/lib/preferences";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getViewerCopy();

  return {
    title: {
      default: BRAND_NAME,
      template: `%s · ${BRAND_NAME}`,
    },
    description: getCopy(locale).brand.tagline || BRAND_DESCRIPTION,
  };
}

/**
 * Mobile-first: every user arrives from a WhatsApp link on a phone. The layout
 * is designed at 390px and widens from there. `maximum-scale` is deliberately
 * left alone so pinch-zoom keeps working.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /*
    Paper and ink, so the browser chrome continues the page instead of ending
    it. Pure white is specifically forbidden by the brand, and it was what sat
    here — a white strip above a cream page reads as a rendering bug.

    Literals rather than tokens because this is a metadata string, not CSS: it
    never reaches a stylesheet, so there is no custom property to resolve.
    Kept in step with --junti-papel by hand.
  */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

/**
 * Reading the language cookie here opts the whole tree into dynamic rendering,
 * including the home page, which could otherwise be served from the CDN. That
 * is the price of honouring the choice everywhere: a page cached in one
 * language would be served to a reader who picked the other.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, theme } = await resolvePreferences();

  return (
    /*
      `data-mode` is what Stackmyth's palette reads to force an appearance.
      Omitting the attribute is not "no theme" — it is "follow the OS", which
      core.vars.css already handles with a `prefers-color-scheme` block. Setting
      it here, on the server, is what prevents the white flash a client-side
      theme toggle produces on every first paint.
    */
    <html lang={getCopy(locale).intlLocale} data-mode={theme ?? undefined}>
      <body>
        <CopyProvider locale={locale}>
          {children}

          {/*
            One toast host for the whole app.

            Top, not the library's default bottom: every form here ends in a
            full-width submit button, and at 390px a bottom toast lands on the
            control you just pressed. The offset clears the signed-in header.

            Icons are not built in — the component ships icon-free on purpose —
            so the variants get theirs here, once, and a success toast looks the
            same wherever it came from.
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
      </body>
    </html>
  );
}
