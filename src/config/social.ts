/**
 * Junti's social accounts, and the one place their URLs live.
 *
 * **Empty entries do not render.** The footer maps over this list and skips
 * anything whose `url` is null, so a network Junti does not have simply is not
 * there — rather than a link to a profile that 404s. That is not caution for
 * its own sake: a footer icon is a promise that an account exists, and a
 * visitor who taps it and lands on "this page isn't available" learns
 * something about the product that is worse than learning nothing.
 *
 * To turn one on, put the profile URL here. Nothing else needs to change.
 *
 * **These are Vennet's accounts, not Junti's**, which is deliberate and
 * temporary: Junti has none yet, and pointing at the house that makes it is
 * truer than pointing at nothing. Swap them the day Junti has its own — the
 * labels stay, only the URLs move.
 *
 * The LinkedIn URL arrived with `?viewAsMember=true` on it. That is a
 * parameter from the logged-in owner's own view of the page, not part of the
 * public address; shipping it would have put a private view-mode flag on every
 * page of the app.
 *
 * `icon` is the exported name from `@stackmyth/icons`, resolved in the footer
 * rather than imported here so this file stays a plain config with no React in
 * it — the same reason `routes.ts` holds strings and not `<Link>`s.
 */
export interface SocialAccount {
  /** Which `@stackmyth/icons` export renders it. */
  icon: "instagram" | "linkedin" | "x" | "threads";
  /** Shown to screen readers and on hover. Never rendered as visible text. */
  label: string;
  /** The profile URL, or null while the account does not exist. */
  url: string | null;
}

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  { icon: "instagram", label: "Instagram", url: "https://www.instagram.com/vennettech" },
  /* X and Threads did not exist in `@stackmyth/icons` until 0.2.0; the marks
     were added for this footer. */
  { icon: "x", label: "X", url: "https://x.com/VennetTech" },
  { icon: "threads", label: "Threads", url: "https://www.threads.com/@vennettech" },
  { icon: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/company/vennet-technologies/" },
];
