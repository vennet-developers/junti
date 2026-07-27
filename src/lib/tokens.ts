import "server-only";

import { randomBytes } from "node:crypto";

/**
 * Access tokens.
 *
 * These URLs *are* the authentication for this app — there are no accounts and
 * no passwords, so a guessable token is a full compromise of an event. Always
 * `crypto.randomBytes`, never `Math.random`, never anything derived from a
 * sequential id or a timestamp.
 *
 * base64url so the value survives a URL, a WhatsApp message and a copy-paste
 * without escaping.
 */

/** 12 bytes → 16 base64url characters ≈ 96 bits. Spec floor is 12 characters. */
const PUBLIC_TOKEN_BYTES = 12;

/** 24 bytes → 32 base64url characters ≈ 192 bits. Spec floor is 24 characters. */
const ORGANIZER_TOKEN_BYTES = 24;

/** 18 bytes → 24 base64url characters. Only ever lives in a cookie. */
const EDIT_TOKEN_BYTES = 18;

function token(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

/** Participant access. Shared freely — this is the link that goes in the group chat. */
export function createPublicToken(): string {
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

/** Lets one device amend its own RSVP without an account. */
export function createEditToken(): string {
  return token(EDIT_TOKEN_BYTES);
}

/**
 * Constant-time string comparison.
 *
 * Token checks are database lookups rather than in-memory comparisons, so
 * timing is not the practical risk here — but where two tokens *are* compared
 * directly (amending an RSVP), doing it in constant time costs nothing and
 * removes the question.
 */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
