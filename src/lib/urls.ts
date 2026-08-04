import "@/server/assert-server";

import { headers } from "next/headers";

/**
 * Absolute URLs for the two access links.
 *
 * Derived from the request headers rather than a configured base URL, so the
 * links are correct on localhost, on a Vercel preview deployment and on the
 * production domain without any environment variable to keep in sync.
 */
export async function origin(): Promise<string> {
  const headerList = await headers();

  // Vercel sets both; a local dev server sets neither.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

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
 * was stored. Keeping the stored value as they wrote it is what lets the
 * organizer read a number that looks like a number.
 */
export function whatsAppContactUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
