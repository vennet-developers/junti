import "@/server/assert-server";

import { randomBytes } from "node:crypto";

/**
 * Access tokens.
 *
 * These URLs are how an event is reached, and the organizer token in particular
 * is full control of one — so a guessable token is a full compromise. Always
 * `crypto.randomBytes`, never `Math.random`, never anything derived from a
 * sequential id or a timestamp.
 *
 * What they are NOT any more is anybody's identity. Accounts do that now: the
 * organizer token says which event you are managing, not who you are, and
 * losing it no longer loses the event. An `edit_token` used to live here too,
 * granting a browser the right to amend the RSVP it had made; it went when
 * answering started requiring an account, and `tokensMatch` — written to compare
 * it in constant time — went with it.
 *
 * base64url so the value survives a URL, a WhatsApp message and a copy-paste
 * without escaping.
 */

/** 12 bytes → 16 base64url characters ≈ 96 bits. Spec floor is 12 characters. */
const PUBLIC_TOKEN_BYTES = 12;

/** 24 bytes → 32 base64url characters ≈ 192 bits. Spec floor is 24 characters. */
const ORGANIZER_TOKEN_BYTES = 24;

function token(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

/** Participant access. Shared freely — this is the link that goes in the group chat. */
export function createPublicToken(): string {
  return token(PUBLIC_TOKEN_BYTES);
}

/**
 * A group's join link.
 *
 * Shared exactly like the participant link — pasted into a chat — and it is
 * what somebody opens to be asked whether they want to join. Public-token
 * length rather than organizer-token length on purpose: it grants no control
 * over anything, only the chance to say yes or no to a name.
 */
export function createGroupToken(): string {
  return token(PUBLIC_TOKEN_BYTES);
}

/**
 * Organizer access. Full control of the event.
 *
 * Must never be sent to the client on a participant route — not in HTML, not in
 * JSON, not in a server-component payload.
 */
export function createOrganizerToken(): string {
  return token(ORGANIZER_TOKEN_BYTES);
}
