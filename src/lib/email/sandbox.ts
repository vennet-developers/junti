/**
 * Marking mail that came from a test.
 *
 * Its own module, and deliberately without `server-only`: this is a pure string
 * function, and living inside `resend.tsx` — which imports the renderer and the
 * server-only guard — meant it could not be tested at all. The guard is there to
 * keep a provider key out of a browser bundle, and there is nothing here worth
 * guarding.
 */

/**
 * How a sandbox message announces itself in an inbox.
 *
 * In the subject rather than the body, because the point is telling two
 * messages apart in a list without opening either. At the front rather than the
 * end: a subject line is truncated from the right on every phone there is.
 */
export const SANDBOX_PREFIX = "[sandbox] ";

/**
 * Marks a subject as a test, once.
 *
 * Idempotent on purpose. Anything that can send the same message twice — a
 * retry, a resend, a future queue that rebuilds it from stored values — must
 * not produce `[sandbox] [sandbox] …`.
 */
export function sandboxSubject(subject: string, sandbox: boolean | undefined): string {
  if (!sandbox || subject.startsWith(SANDBOX_PREFIX)) return subject;
  return `${SANDBOX_PREFIX}${subject}`;
}
