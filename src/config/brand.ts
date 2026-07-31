/**
 * The single source of truth for the product name.
 *
 * Renaming the product must cost one commit, not a migration. Nothing outside
 * this module may hardcode the brand string — not routes, not table names, not
 * CSS classes, not copy. Everything that needs the name imports it from here.
 *
 * @see DECISIONS.md — "Branding is a one-module concern"
 */

export const BRAND_NAME = "Junti";

export const BRAND_TAGLINE = "Quién viene y quién ya pagó.";

/** Used in <title> metadata and anywhere the name needs a descriptor next to it. */
export const BRAND_DESCRIPTION =
  "Organiza partidos, fiestas y parches sin contraseñas. Comparte un link y listo.";
