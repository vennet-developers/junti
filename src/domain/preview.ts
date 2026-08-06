/**
 * Seeing the event page through somebody else's eyes.
 *
 * An organizer cannot check what they are about to share. Their own session
 * makes the page render for them, and the two views that actually matter —
 * what an invitee lands on, and what a stranger with no account sees — are the
 * two they can never reach without logging out or opening a private window.
 * That is where the sign-in gate lives, and it is the first thing every person
 * they invite will meet.
 *
 * **A preview only ever takes things away.** Every mode below is the reader's
 * real payload with fields removed, never with anything added: there is no mode
 * that grants a view somebody would not otherwise have, so the worst a bug here
 * can do is show the organizer less of their own event. That is the property
 * that makes this safe to hang off a query string, and it is worth keeping —
 * the moment a mode has to *add* something, it stops being a preview and
 * becomes an impersonation.
 *
 * **Only the event's owner may use it**, and for anybody else the parameter is
 * ignored rather than refused. A refusal would answer the question "is this
 * event mine?" for whoever asked, and a link with `?as=` on it is the kind of
 * thing that gets pasted into a group chat by accident.
 */

export const PREVIEW_MODES = [
  /** Signed in, invited, has not answered yet. The state most invitees arrive in. */
  "guest",
  /** No account at all. Meets the sign-in gate. */
  "stranger",
] as const;

export type PreviewMode = (typeof PREVIEW_MODES)[number];

/**
 * The mode a URL is asking for, or null for "render normally".
 *
 * Total and silent: anything unrecognised is null rather than an error. This
 * reads a query string, and a query string is edited by hand, truncated by
 * chat apps and appended to by link trackers — none of which should be able to
 * break the page an organizer is trying to look at.
 */
export function parsePreviewMode(raw: unknown): PreviewMode | null {
  return (PREVIEW_MODES as readonly unknown[]).includes(raw) ? (raw as PreviewMode) : null;
}

/** What the reader is allowed to see themselves as. */
export interface PreviewInput {
  /** The requested mode, already parsed. */
  requested: PreviewMode | null;
  /** Whether the signed-in reader owns this event. */
  isOwner: boolean;
}

/**
 * The mode actually in force.
 *
 * Separate from parsing because the two failures are different: an unknown
 * value is a typo, and a known value from somebody who does not own the event
 * is the case this function exists for.
 */
export function effectivePreviewMode({ requested, isOwner }: PreviewInput): PreviewMode | null {
  return isOwner ? requested : null;
}

/**
 * The mode a route's loader payload reports, or null.
 *
 * The app shell renders above the event page and has no access to its search
 * params — but it does have the loader data, and the loader is where ownership
 * was actually checked. Reading the verdict rather than re-reading the URL is
 * what keeps `?as=stranger` from changing the chrome for somebody who does not
 * own the event: {@link effectivePreviewMode} already returned null for them,
 * so there is nothing here to find.
 *
 * Defensive about the shape because it is handed one payload per matched
 * route, most of which have no `preview` key at all.
 */
export function previewModeOf(loaderData: unknown): PreviewMode | null {
  if (typeof loaderData !== "object" || loaderData === null) return null;
  return parsePreviewMode((loaderData as { preview?: unknown }).preview);
}

/**
 * The two facts the whole page hangs off.
 *
 * `signedIn` decides whether the roster is readable or sits behind the gate.
 * `ownStake` decides whether the reader has an answer of their own to change,
 * something they owe, and something they promised to bring — everything the
 * page shows because *you* are in it rather than merely looking at it.
 */
export interface ReaderView {
  signedIn: boolean;
  ownStake: boolean;
}

/**
 * The reader as the requested mode would see them.
 *
 * **Every branch narrows.** `guest` keeps the session, because an invitee is
 * signed in, and drops the stake: no answer of their own to change. `stranger`
 * drops the session too, which is what puts the sign-in gate back over the
 * roster. Nothing is ever turned on, only off — which is why a reader who
 * genuinely has neither comes out of every mode with neither, and why no bug
 * in here can show one person another person's page.
 */
export function previewReader(real: ReaderView, mode: PreviewMode | null): ReaderView {
  if (mode === null) return real;

  return {
    signedIn: real.signedIn && mode !== "stranger",
    ownStake: false,
  };
}
