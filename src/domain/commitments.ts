/**
 * What somebody says they are bringing, and the rules around saying it.
 *
 * Pure functions over plain data — no framework, no database. The validation
 * lives here rather than in the Zod schema because two of these rules are
 * about meaning rather than shape: a row with neither a note nor a reaction is
 * not "invalid input", it is a request to have nothing to say, and an emoji
 * outside the list is not malformed, it is simply not one of ours.
 */

/**
 * The reactions on offer.
 *
 * A fixed list rather than a picker, for two reasons the ticket names. Rendering
 * is one: arbitrary emoji include zero-width joiner sequences that render as
 * two glyphs on one platform and a box on another, and a roster full of boxes
 * is worse than no reactions. Moderation is the other: nothing here can be
 * used to say something unpleasant to somebody, so there is no moderation
 * queue to build.
 *
 * Chosen for the plans Junti is actually used for — a match, a cookout, a trip.
 */
export const REACTIONS = ["⚽", "🎂", "🍻", "🔥", "🎉", "🏃", "🥁", "👏"] as const;

export type Reaction = (typeof REACTIONS)[number];

/**
 * Long enough for "yo llevo el balón y la malla", short enough that the feed
 * stays a feed. Counted in code points, so an emoji-heavy note is measured the
 * way a reader sees it rather than by UTF-16 units.
 */
export const NOTE_MAX = 80;

export interface CommitmentDraft {
  note: string | null;
  reaction: string | null;
}

export type CommitmentProblem = "empty" | "too-long" | "unknown-reaction";

export interface CommitmentCheck {
  ok: boolean;
  problem?: CommitmentProblem;
  /** The values to store, trimmed and normalised. Only when `ok`. */
  value?: CommitmentDraft;
}

export function isReaction(value: string | null): value is Reaction {
  return value !== null && (REACTIONS as readonly string[]).includes(value);
}

/** How long a note reads as, counting an emoji as one character. */
export function noteLength(note: string): number {
  return Array.from(note).length;
}

/**
 * Validates and normalises what somebody typed.
 *
 * Empty strings become null on the way in, so "cleared the box and saved" and
 * "never filled it in" end up as the same row rather than as an empty string
 * that renders as a blank line in the feed.
 */
export function checkCommitment(draft: CommitmentDraft): CommitmentCheck {
  const note = draft.note?.trim() ?? "";
  const reaction = draft.reaction?.trim() || null;

  if (reaction !== null && !isReaction(reaction)) {
    return { ok: false, problem: "unknown-reaction" };
  }

  if (noteLength(note) > NOTE_MAX) {
    return { ok: false, problem: "too-long" };
  }

  // Nothing to say is not a commitment. The caller deletes instead.
  if (note.length === 0 && reaction === null) {
    return { ok: false, problem: "empty" };
  }

  return { ok: true, value: { note: note.length > 0 ? note : null, reaction } };
}

/**
 * Whether this reader may remove a given note.
 *
 * The author always may. The organizer may remove anybody's, because it is
 * their event and their name on it — the ticket asks for that rather than for
 * a moderation queue nobody would staff.
 */
export function canDeleteCommitment(input: {
  authorParticipantId: string;
  readerParticipantId: string | null;
  readerIsOrganizer: boolean;
}): boolean {
  return (
    input.readerIsOrganizer || input.readerParticipantId === input.authorParticipantId
  );
}
