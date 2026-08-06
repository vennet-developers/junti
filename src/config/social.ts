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
  { icon: "instagram", label: "Instagram", url: null },
  /* X and Threads did not exist in `@stackmyth/icons` until 0.2.0; the marks
     were added for this footer. */
  { icon: "x", label: "X", url: null },
  { icon: "threads", label: "Threads", url: null },
  { icon: "linkedin", label: "LinkedIn", url: null },
];
