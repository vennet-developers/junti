import "@/server/assert-server";

import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Absolute URLs for the two access links.
 *
 * Derived from the request headers rather than a configured base URL, so the
 * links are correct on localhost, on a Vercel preview deployment and on the
 * production domain without any environment variable to keep in sync.
 */
export async function origin(): Promise<string> {
  // Vercel sets both; a local dev server sets neither. Still async although
  // the helpers are sync now, so its many call sites keep their `await`.
  const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "localhost:3000";
  const protocol =
    getRequestHeader("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

export {
  managePath,
  participantPath,
  whatsAppContactUrl,
  whatsAppShareUrl,
} from "./paths";
