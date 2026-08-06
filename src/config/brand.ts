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

/**
 * Used in `<meta name="description">` and anywhere the name needs a descriptor
 * next to it.
 *
 * Leads with the name because this string is read by machines and by reviewers
 * before it is read by anybody deciding whether to click: Google refused OAuth
 * verification on the grounds that the homepage did not say what the app is
 * for, and a description that opens with a verb answers "for what" without ever
 * answering "what".
 */
export const BRAND_DESCRIPTION = `${BRAND_NAME} es una app gratuita para organizar planes con tu gente: comparte un link, cada invitado dice si viene, y ves quién va y quién ya pagó.`;
