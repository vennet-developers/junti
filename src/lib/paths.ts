/**
 * Pure path builders — the client-safe half of what `urls.ts` used to be.
 *
 * Split out when the event page's sign-in card became a client component: it
 * needs `participantPath` to build a return URL, and the module that carried
 * it also carries `origin()`, which reads request headers and is server-only.
 * Under Next the card was a server component and nobody noticed the coupling;
 * under TanStack the tripwire did.
 *
 * `urls.ts` re-exports all of these, so server code keeps its imports.
 */

export function participantPath(publicToken: string): string {
  return `/e/${publicToken}`;
}

export function managePath(publicToken: string, organizerToken: string): string {
  return `/e/${publicToken}/manage/${organizerToken}`;
}

/** `https://wa.me/?text=…` with the message pre-filled. */
export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * A chat with one person, for an organizer chasing somebody.
 *
 * `wa.me` wants digits and nothing else — no `+`, no spaces — so whatever the
 * person typed is reduced to digits here rather than at the boundary where it
 * was stored.
 */
export function whatsAppContactUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
