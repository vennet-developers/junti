/**
 * The invitation an organizer sends, as a template.
 *
 * The app writes one by default, in the reader's language. An organizer who
 * wants their own writes it once — see `/messages` — and it is used for every
 * event they share from then on.
 *
 * **Placeholders are `{title}`, `{when}` and `{link}`, in English, in both
 * languages.** They are not prose: they are slots the editor inserts with
 * buttons and labels in the reader's language, and keeping the token itself
 * fixed means a template survives its author switching the interface to
 * English, and means one renderer rather than one per locale.
 *
 * Pure, and deliberately in `lib` rather than beside the page: the server
 * renders the message for the share links, the editor renders it for the live
 * preview, and both must agree exactly — a preview that lies is worse than no
 * preview.
 */

/** What an organizer may drop into their message. */
export const SHARE_PLACEHOLDERS = ["title", "when", "link"] as const;

export type SharePlaceholder = (typeof SHARE_PLACEHOLDERS)[number];

/**
 * Long enough for a paragraph and a link, short enough to stay a message.
 *
 * WhatsApp itself takes far more, but the whole thing is percent-encoded into
 * a URL that some Android launchers truncate around 2000 characters — and a
 * link that arrives cut is the one failure this feature must not have.
 */
export const SHARE_MESSAGE_MAX_LENGTH = 400;

export type ShareMessageProblem = "empty" | "missing-link" | "too-long";

/**
 * Why this template cannot be saved, or null when it can.
 *
 * `missing-link` is the one that matters. Everything else about an invitation
 * is taste; a message without the event's address is one nobody can answer,
 * and it would fail silently — the organizer would see their words arrive in
 * WhatsApp and never learn that no one could reply.
 */
export function shareMessageProblem(template: string): ShareMessageProblem | null {
  const value = template.trim();

  if (value.length === 0) return "empty";
  if (value.length > SHARE_MESSAGE_MAX_LENGTH) return "too-long";
  if (!value.includes("{link}")) return "missing-link";

  return null;
}

/** Built from the list above, so there is one place to add a placeholder. */
const PLACEHOLDER_PATTERN = new RegExp(`\\{(${SHARE_PLACEHOLDERS.join("|")})\\}`, "g");

/**
 * Fills a template in.
 *
 * **One pass, so a value is never itself treated as a template.** Replacing the
 * placeholders one after another meant an event whose title happened to read
 * `{when}` had the date substituted into it on the next round — absurd as a
 * title, ordinary as a bug, and the sort that only shows up in somebody's real
 * data. A single scan cannot reach what it has already written.
 *
 * Unknown placeholders are left exactly as typed rather than stripped: `{titel}`
 * showing up in the preview is how somebody finds their typo, whereas silently
 * deleting it produces a sentence with a hole in it and no explanation.
 */
export function renderShareMessage(
  template: string,
  values: Record<SharePlaceholder, string>,
): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, name: SharePlaceholder) => values[name]);
}
