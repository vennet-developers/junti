/**
 * Every static path in the app, in one place.
 *
 * Two reasons this is a module and not a set of string literals scattered
 * across pages:
 *
 * 1. **Routes are code, and code in this project is English.** They were
 *    briefly not — `/entrar`, `/mis-eventos`, `/perfil` — and the only reason
 *    that was possible is that no single file was obviously responsible for
 *    them. Renaming a route now means editing one line here and following the
 *    compiler.
 * 2. A path typed in two places drifts. A redirect that still points at the old
 *    one fails silently: the user just lands on a 404.
 *
 * UI copy stays Spanish (and English) — see `src/config/copy/`. That split is
 * deliberate: what a human reads is translated, what a machine reads is not.
 *
 * No `server-only`: links are rendered on both sides.
 */
export const ROUTES = {
  home: "/",
  newEvent: "/new",
  signIn: "/sign-in",
  myEvents: "/my-events",
  profile: "/profile",
  /**
   * First run, for an account the identity provider told us nothing about.
   * Reached only from the auth callback; see `ensureProfile`.
   */
  onboarding: "/onboarding",
  /**
   * The privacy notice. Public and indexable, unlike everything else here —
   * a notice nobody can reach without an account is not a notice.
   */
  privacy: "/privacy",
  /** Where an unsubscribe link in an email lands. No account required. */
  unsubscribe: "/unsubscribe",
  /**
   * What the organizer's guests receive, as opposed to `/profile`, which is
   * how the organizer sees the app. The two are settings screens and the split
   * between them is who the setting affects.
   */
  messages: "/messages",
  /** Every receipt waiting on this organizer, across all of their events. */
  approvals: "/approvals",
  /** Where Google and the emailed links land. */
  authCallback: "/auth/callback",
} as const;

/**
 * The sign-in page, remembering where to return to.
 *
 * `next` is encoded here rather than at each call site, because it is a path
 * inside a query string and forgetting to encode it is the kind of thing that
 * works until somebody's destination contains an ampersand.
 */
export function signInPath(next?: string): string {
  if (!next) return ROUTES.signIn;
  return `${ROUTES.signIn}?next=${encodeURIComponent(next)}`;
}
