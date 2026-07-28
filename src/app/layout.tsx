import type { Metadata, Viewport } from "next";

// ── Stackmyth ────────────────────────────────────────────────────────────────
// EVERY package ships TWO stylesheets and both are required:
//   <name>.vars.css  — the CSS custom properties the styles resolve against
//   <name>.css       — the rules that consume them
//
// Importing only the second is the trap: components still pick up their class
// names and still look *mostly* styled, but every declaration written as
// `gap: var(--sm-space-5)` silently collapses to its initial value. The result
// is a page with correct colors and no spacing at all, which reads as "my
// layout code is wrong" rather than "a stylesheet is missing".
// Logged in STACKMYTH-GAPS.md — "Two stylesheets per package, no diagnostic".
//
// Order matters: core tokens first, then the self-hosted font (sets
// --sm-font-family), then per-package tokens, then per-package styles.
//
// The default palette in core.vars.css (no `data-theme` attribute) is the
// neutral one and already ships a `prefers-color-scheme: dark` block, so light
// and dark both work with zero configuration and zero network requests.
// See DECISIONS.md — "No Stackmyth theme file".
import "@stackmyth/core/core.vars.css";
import "@stackmyth/core/fonts/geist.css";

import "@stackmyth/layout/layout.vars.css";
import "@stackmyth/text/text.vars.css";
import "@stackmyth/button/button.vars.css";
import "@stackmyth/input/input.vars.css";
import "@stackmyth/textarea/textarea.vars.css";
import "@stackmyth/label/label.vars.css";
import "@stackmyth/field/field.vars.css";
import "@stackmyth/select/select.vars.css";
import "@stackmyth/radio-group/radio-group.vars.css";
import "@stackmyth/switch/switch.vars.css";
import "@stackmyth/card/card.vars.css";
import "@stackmyth/badge/badge.vars.css";
import "@stackmyth/alert/alert.vars.css";
import "@stackmyth/dialog/dialog.vars.css";
import "@stackmyth/list-item/list-item.vars.css";
import "@stackmyth/empty-state/empty-state.vars.css";
import "@stackmyth/stat/stat.vars.css";
import "@stackmyth/progress/progress.vars.css";
import "@stackmyth/spinner/spinner.vars.css";
import "@stackmyth/skeleton/skeleton.vars.css";
import "@stackmyth/accordion/accordion.vars.css";
import "@stackmyth/avatar/avatar.vars.css";
import "@stackmyth/popover/popover.vars.css";
import "@stackmyth/calendar/calendar.vars.css";
import "@stackmyth/time-picker/time-picker.vars.css";
import "@stackmyth/form/form.vars.css";

import "@stackmyth/layout/layout.css";
import "@stackmyth/text/text.css";
import "@stackmyth/button/button.css";
import "@stackmyth/input/input.css";
import "@stackmyth/textarea/textarea.css";
import "@stackmyth/label/label.css";
import "@stackmyth/field/field.css";
import "@stackmyth/select/select.css";
import "@stackmyth/radio-group/radio-group.css";
import "@stackmyth/switch/switch.css";
import "@stackmyth/card/card.css";
import "@stackmyth/badge/badge.css";
import "@stackmyth/alert/alert.css";
import "@stackmyth/dialog/dialog.css";
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

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/config/brand";

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
};

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}
