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
import "@stackmyth/core/fonts/geist.css";

import "@stackmyth/layout/layout.css";
import "@stackmyth/text/text.css";
import "@stackmyth/button/button.css";
import "@stackmyth/input/input.css";
import "@stackmyth/input-group/input-group.css";
import "@stackmyth/textarea/textarea.css";
import "@stackmyth/label/label.css";
import "@stackmyth/field/field.css";
import "@stackmyth/select/select.css";
import "@stackmyth/radio-group/radio-group.css";
import "@stackmyth/switch/switch.css";
import "@stackmyth/checkbox/checkbox.css";
import "@stackmyth/file-upload/file-upload.css";
import "@stackmyth/card/card.css";
import "@stackmyth/badge/badge.css";
import "@stackmyth/alert/alert.css";
import "@stackmyth/dialog/dialog.css";
import "@stackmyth/dropdown-menu/dropdown-menu.css";
import "@stackmyth/tabs/tabs.css";
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
import "@stackmyth/time-picker/time-picker.css";
import "@stackmyth/form/form.css";

import "./globals.css";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
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
        <CopyProvider locale={locale}>{children}</CopyProvider>
      </body>
    </html>
  );
}
